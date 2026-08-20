import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import * as cheerio from "cheerio";
import * as z from "zod";
import { writeFile } from "node:fs/promises";

const BookSchema = z.object({
  title: z.string().nonempty(),
  product_url: z.string(),
  price_text: z.string(),
  price_gbp: z.union([
    z.number(),
    z.string().transform((val) => parseFloat(val.replace(/[^0-9.]/g, "")))
  ]),
  availability_text: z.string(),
  rating_text: z.string(),
  description: z.string().optional().default("..."),
  source_page: z.string(),
  fetched_at: z.coerce.date().default(() => new Date()),
});

type Book = z.output<typeof BookSchema>;

class ErrorBook{
  error_message: string;
  public readonly book: unknown;
  constructor(message: string, book: unknown){
    this.error_message = message,
    this.book = book;
  }
}

const ErrorBooks: ErrorBook[] = []; 

const Site_URL: string = "https://books.toscrape.com/catalogue/";
const bookURLs = new Map<string, URL>(); // stores detail page URL and Source Page URL
const Books = new Map<string, Book>();
let detailPages: number = 0;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestPage = async (url: string) => {
  await delay(1500);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html",
      "User-Agent":
        "FlyRankInternship-A9/1.0 (https://github.com/Muhammad-Fahad-MF/Books-Scraper)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }
  return response;
};

const CAT_CACHE_DIR = "./cache/catalogue_pages";

const readCatHTML = async (url: URL): Promise<string> => {
  try {
    if(!existsSync(CAT_CACHE_DIR)){
      mkdirSync(CAT_CACHE_DIR, { recursive: true });
    }

    const files = readdirSync(CAT_CACHE_DIR);
    let page = url.href.split("/").pop() as string;
    if (files.includes(page)) {
      console.log("Hit!");
      const html = readFileSync(`${CAT_CACHE_DIR}/${page}`, {
        encoding: "utf-8",
      });
      return html;
    }
    console.log("Miss, Requesting ", url.href);
    const response = await requestPage(url.href);
    const html = await response.text();
    await writeFile(`${CAT_CACHE_DIR}/${page}`, html, "utf-8");
    return html;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const DETAIL_CACHE_DIR = "./cache/detail_pages";

const readDetailsHTML = async (bookPage: string) => {
  try {
    if (!existsSync(DETAIL_CACHE_DIR)) {
      mkdirSync(DETAIL_CACHE_DIR, { recursive: true });
    }

    const slug = bookPage.split("/").filter(Boolean).at(-2) || "index";
    const fileName = `${slug}.html`;

    const cachedPages = readdirSync(DETAIL_CACHE_DIR);

    if (cachedPages.includes(fileName)) {
      return readFileSync(`${DETAIL_CACHE_DIR}/${fileName}`, "utf-8");
    }

    console.log(`[CACHE MISS] Fetching ${bookPage}...`);

    const response = await requestPage(bookPage);
    const html = await response.text();

    await writeFile(`${DETAIL_CACHE_DIR}/${fileName}`, html, "utf-8");
    console.log(`[WRITE SUCCESS] Saved to ${fileName}`);

    return html;
  } catch (err) {
    console.error("Failed in readDetailsHTML:", err);
    throw err;
  }
};

const OUTPUT_DIR = "./output";
const BOOK_FILE = "books.json";
const ERROR_FILE = "errors.json";

const readRecordsJSON = () => {
  try {
    if(!existsSync(`${OUTPUT_DIR}/${BOOK_FILE}`)){
      return;
    }
    const data = readFileSync(`${OUTPUT_DIR}/${BOOK_FILE}`, "utf-8");
    const jsonParsed: Book = JSON.parse(data);
    const parsed = z.array(z.tuple([z.string(), BookSchema])).parse(jsonParsed);
    parsed.forEach((val) => {
      Books.set(...val);
    })
  } catch (err) {
    console.error("Failed in readRecordJSON: ", err); 
    throw err;
  }
}

const writeErrorsJSON = async () => {
  const jsonErrors = JSON.stringify(ErrorBooks, null, 2);
  await writeFile(`${OUTPUT_DIR}/${ERROR_FILE}`, jsonErrors, "utf-8");
}

const writeRecordsJSON = async () => {
  if(!existsSync(OUTPUT_DIR)){
    mkdirSync(OUTPUT_DIR);
  }
  const record = Array.from(Books.entries());
  const jsonRecord = JSON.stringify(record, null, 2);
  writeFileSync(`${OUTPUT_DIR}/${BOOK_FILE}`, jsonRecord, "utf-8");
  await writeErrorsJSON();
}


const extractDetails = async (bookPage: string, sourcePage: URL) => {
  const detailHtml = await readDetailsHTML(bookPage);
  const $ = cheerio.load(detailHtml);
  const book = $(".product_main");
  let title = book.find("h1").text();
  let price = book.find(".price_color").text();
  let available = book.find(".availability").text().trim();
  let ratingClass = book.find(".star-rating").attr("class");
  let rating = "Unrated";
  if (ratingClass) {
    const match = ratingClass.match(/\b(One|Two|Three|Four|Five)\b/);
    rating = match ? match[0] : "Unrated";
  }
  let details = $("#product_description").next().text().replaceAll("...more", "")?.trim();
  let cleanDetails = details ? details.replace(/[\s\u00A0]+/g, " ") : "...";
  const rawData = {
    title: title,
    product_url: bookPage,
    price_text: price,
    price_gbp: price,
    availability_text: available,
    rating_text: rating,
    description: cleanDetails,
    source_page: sourcePage.href,
  };
  const bookObject = BookSchema.safeParse(rawData);
  if(!bookObject.success){
    const errorBook = new ErrorBook(z.prettifyError(bookObject.error), rawData);
    ErrorBooks.push(errorBook);
    return;
  }
  detailPages++;
  Books.set(bookPage, bookObject.data);
};

readRecordsJSON();
let current_page = new URL("page-1.html", Site_URL);

for (let i = 1; i <= 3; i++) {
  const html = await readCatHTML(current_page);
  const $ = cheerio.load(html);

  const links: string[] = $(".product_pod > h3 > a")
    .map((_index, item) => $(item).attr("href"))
    .get();
  links.forEach((link) => {
    let url = new URL(link as string, current_page.href);
    if (!Books.has(url.href)) {
      bookURLs.set(url.href, current_page);
    }
  });
  const next_href = $(".next > a").attr("href");
  if (next_href && i <= 3) {
    current_page = new URL(next_href, Site_URL);
  } else {
    break;
  }
}

for (const [detailURL, sourceURL] of bookURLs.entries()) {
  await extractDetails(detailURL, sourceURL);
}

console.log(
  JSON.stringify(
    Books.get(
      "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    ),
  ),
);
console.log(Books.size);
writeRecordsJSON();
