import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import * as cheerio from "cheerio";

class Book {
  static detailPages = 0;
  title: string;
  product_url: string;
  price_text: string;
  availability_text: string;
  rating_text: string;
  description: string | undefined;
  source_page: string;
  fetched_at: Date;
  constructor(
    title: string,
    product_url: string,
    price_text: string,
    availability_text: string,
    rating_text: string,
    description: string | undefined,
    source_page: string,
  ) {
    this.title = title;
    this.product_url = product_url;
    this.price_text = price_text;
    this.availability_text = availability_text;
    this.rating_text = rating_text;
    this.description = description ?? "...";
    this.source_page = source_page;
    this.fetched_at = new Date();
    Book.detailPages++;
  }
}

const Site_URL: string = "https://books.toscrape.com/catalogue/";
const URLs = new Set<URL>();
const Books: Book[] = [];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestPage = async (url: URL) => {
  await delay(1500);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html",
      "User-Agent":
        "FlyRankInternship-A9/1.0 (https://github.com/Muhammad-Fahad-MF/Books-Scraper)",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }
  return response;
};

const readCatHTML = async (url: URL): Promise<string> => {
  try {
    const files = readdirSync("./cache/catalogue_pages");
    let page = url.href.split("/").pop() as string;
    if (files.includes(page)) {
      console.log("Hit!");
      const html = readFileSync(`./cache/catalogue_pages/${page}`, {
        encoding: "utf-8",
      });
      return html;
    }
    console.log("Miss, Requesting ", url.href);
    const response = await requestPage(url);
    const html = await response.text();
    writeFileSync(`./cache/catalogue_pages/${page}`, html, "utf-8");
    return html;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const DETAIL_DIR = "./cache/detail_pages";

const readDetailsHTML = async (bookPage: URL) => {
  try {
    if (!existsSync(DETAIL_DIR)) {
      mkdirSync(DETAIL_DIR, { recursive: true });
    }

    const slug = bookPage.href.split("/").filter(Boolean).at(-2) || "index";
    const fileName = `${slug}.html`;

    const cachedPages = readdirSync(DETAIL_DIR);

    if (cachedPages.includes(fileName)) {
      return readFileSync(`${DETAIL_DIR}/${fileName}`, "utf-8");
    }

    console.log(`[CACHE MISS] Fetching ${bookPage.href}...`);

    const response = await requestPage(bookPage);
    const html = await response.text();

    writeFileSync(`${DETAIL_DIR}/${fileName}`, html, "utf-8");
    console.log(`[WRITE SUCCESS] Saved to ${fileName}`);

    return html;
  } catch (err) {
    console.error("Failed in readDetailsHTML:", err);
    throw err;
  }
};

const extractDetails = async (bookPage: URL, sourcePage: URL) => {
  const detailHtml = await readDetailsHTML(bookPage);
  const $ = cheerio.load(detailHtml);
  const book = $(".product_main");
  let title = book.find("h1").text();
  let url = bookPage.href;
  let price = book.find(".price_color").text();
  let available = book.find(".availability").text().trim();
  let ratingClass = book.find(".star-rating").attr("class");
  let rating = "Unrated";
  if (ratingClass) {
    const match = ratingClass.match(/\b(One|Two|Three|Four|Five)\b/);
    rating = match ? match[0] : "Unrated";
  }
  let details = $("#product_description").next().text().split("...")[0]?.trim();
  let cleanDetails = details ? details.replace(/[\s\u00A0]+/g, " ") : "...";
  const bookObject = new Book(
    title,
    url,
    price,
    available,
    rating,
    cleanDetails,
    sourcePage.href,
  );
  Books.push(bookObject);
};

let current_page = new URL("page-1.html", Site_URL);

for (let i = 1; i <= 3; i++) {
  const html = await readCatHTML(current_page);
  const $ = cheerio.load(html);

  const links: string[] = $(".product_pod > h3 > a")
    .map((_index, item) => $(item).attr("href"))
    .get();
  links.forEach((link) => {
    let url = new URL(link as string, Site_URL);
    URLs.add(url);
  });
  links.length = 0;
  URLs.forEach((el)=>{
    extractDetails(el, current_page);
  })
  const next_href = $(".next > a").attr("href");
  if (next_href && i <= 3) {
    current_page = new URL(next_href, Site_URL);
  } else {
    break;
  }
}

console.log(`\nDetail Pages: ${Book.detailPages} \n`);
console.log(JSON.stringify(Books[0]));
