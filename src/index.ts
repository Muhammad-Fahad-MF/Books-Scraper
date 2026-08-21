import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  WriteStream,
} from "node:fs";
import * as cheerio from "cheerio";
import * as z from "zod";
import { writeFile } from "node:fs/promises";
import { AsyncParser, Transform } from "@json2csv/node";
import { Readable } from "node:stream";

const BookSchema = z.object({
  title: z.string().nonempty(),
  product_url: z.string(),
  price_text: z.string(),
  price_gbp: z.union([
    z.number(),
    z.string().transform((val) => parseFloat(val.replace(/[^0-9.]/g, ""))),
  ]),
  availability_text: z.string(),
  rating_text: z.string(),
  description: z.string().nullable(),
  source_page: z.string(),
  fetched_at: z.coerce.date().default(() => new Date()),
});

type Book = z.output<typeof BookSchema>;

class ErrorBook {
  error_message: string;
  public readonly book: unknown;
  constructor(message: string, book: unknown) {
    ((this.error_message = message), (this.book = book));
  }
}

const ErrorBooks: ErrorBook[] = [];

class RunReport {
  startTime: Date;
  duration: number = 0;
  pages_fetched: number = 0;
  cache_hits: number = 0;
  valid_records: number = 0;
  invalid_records: number = 0;
  failed_pages: number = 0;

  constructor() {
    this.startTime = new Date();
  }

  setDuration() {
    this.duration = Date.now() - this.startTime.getTime();
  }
}

const Site_URL: string = "https://books.toscrape.com/catalogue/";
const bookURLs = new Map<string, URL>(); // stores detail page URL and Source Page URL
const Books = new Map<string, Book>();
const report = new RunReport();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const requestPage = async (url: string, retriesLeft = 1): Promise<Response> => {
  try {
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
      throw new Error(`HTTP ${response.status}: ${url}`);
    }

    report.pages_fetched++;
    return response;
  } catch (err: any) {
    const isPermanent =
      err?.message?.includes("404") || err?.message?.includes("403");

    if (retriesLeft > 0 && !isPermanent) {
      console.log(`[RETRYING] ${url}`);
      await delay(2500);
      return requestPage(url, retriesLeft - 1);
    }

    report.failed_pages++;
    throw err;
  }
};

const CAT_CACHE_DIR = "./cache/catalogue_pages";

const readCatHTML = async (url: URL): Promise<string> => {
  try {
    if (!existsSync(CAT_CACHE_DIR)) {
      mkdirSync(CAT_CACHE_DIR, { recursive: true });
    }

    const files = readdirSync(CAT_CACHE_DIR);
    let page = url.href.split("/").pop() as string;
    if (files.includes(page)) {
      console.log("Hit!");
      report.cache_hits++;
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
      report.cache_hits++;
      return readFileSync(`${DETAIL_CACHE_DIR}/${fileName}`, "utf-8");
    }

    console.log(`[CACHE MISS] Fetching ${bookPage}...`);

    const response = await requestPage(bookPage);
    const html = await response.text();

    await writeFile(`${DETAIL_CACHE_DIR}/${fileName}`, html, "utf-8");
    console.log(`[WRITE SUCCESS] Saved to ${fileName}`);

    return html;
  } catch (err) {
    throw err;
  }
};

const OUTPUT_DIR = "./output";
const BOOK_FILE = "books.json";
const ERROR_FILE = "errors.json";
const CSV_FILE = "books.csv";

const readRecordsJSON = () => {
  try {
    if (!existsSync(`${OUTPUT_DIR}/${BOOK_FILE}`)) {
      return;
    }
    const data = readFileSync(`${OUTPUT_DIR}/${BOOK_FILE}`, "utf-8");
    const jsonParsed: Book = JSON.parse(data);
    const parsed = z.array(BookSchema).parse(jsonParsed);
    parsed.forEach((val) => {
      Books.set(val.product_url, val);
    });
  } catch (err) {
    console.error("Failed in readRecordJSON: ", err, "\n\n");
    throw err;
  }
};

const writeErrorsJSON = async () => {
  const jsonErrors = JSON.stringify(ErrorBooks, null, 2);
  await writeFile(`${OUTPUT_DIR}/${ERROR_FILE}`, jsonErrors, "utf-8");
};

const writeRecordsJsonNCsv = async () => {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR);
  }
  const record = Array.from(Books.values());
  const jsonRecord = JSON.stringify(record, null, 2);
  const csvParser = new AsyncParser({
    fields: [
      "title",
      "product_url",
      "price",
      "price_gbp",
      "availability_text",
      "rating_text",
      "description",
      "source_page",
      "fetched_at",
    ],
  });
  const csv = csvParser.parse(record);
  await writeFile(`${OUTPUT_DIR}/${CSV_FILE}`, csv, "utf-8");
  await writeFile(`${OUTPUT_DIR}/${BOOK_FILE}`, jsonRecord, "utf-8");
  await writeErrorsJSON();
};

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
  let details = $("#product_description")
    .next()
    .text()
    .replaceAll("...more", "")
    ?.trim();
  let cleanDetails = details ? details.replace(/[\s\u00A0]+/g, " ") : null;
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
  if (!bookObject.success) {
    const errorBook = new ErrorBook(z.prettifyError(bookObject.error), rawData);
    ErrorBooks.push(errorBook);
    report.invalid_records++;
    return;
  }
  report.valid_records++;
  Books.set(bookPage, bookObject.data);
};

const writeReportJSON = async () => {
  report.setDuration();
  console.log(report);
  const json = JSON.stringify(report, null, 2);
  await writeFile(`${OUTPUT_DIR}/run-report.json`, json, "utf-8");
};

readRecordsJSON();
let current_page = new URL("page-1.html", Site_URL);

for (let i = 1; i <= 3; i++) {
  try {
    const html = await readCatHTML(current_page);
    const $ = cheerio.load(html);

    const links: string[] = $(".product_pod > h3 > a")
      .map((_index, item) => $(item).attr("href"))
      .get();
    links.forEach((link) => {
      let url = new URL(link as string, current_page.href);
      bookURLs.set(url.href, current_page);
    });
    const next_href = $(".next > a").attr("href");
    if (next_href && i <= 3) {
      current_page = new URL(next_href, Site_URL);
    } else {
      break;
    }
  } catch (err) {
    console.log(err, "\n\n");
    continue;
  }
}

// Fake URL to Test!
bookURLs.set(
  "https://books.toscrape.com/catalogue/a-light-in-the-attic_10/index.html",
  current_page,
);
for (const [detailURL, sourceURL] of bookURLs.entries()) {
  try {
    await extractDetails(detailURL, sourceURL);
  } catch (err) {
    console.log(err, "\n\n");
    continue;
  }
}

console.log(
  JSON.stringify(
    Books.get(
      "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    ),
  ),
);

await writeRecordsJsonNCsv();
await writeReportJSON();
