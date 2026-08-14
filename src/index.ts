import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";

const Site_URL: string = "https://books.toscrape.com/catalogue/";
const URLs = new Set<URL>();
let catalougesPages = 0, discoveredBooks = 0, uniqueBooks = 0;

const ReadHTML = async (url: URL): Promise<string> => {
  try {
    const files = readdirSync("./cache");
    let page = url.href.split("/").pop() as string;
    if (files.includes(page)) {
      console.log("Hit!");
      const html = readFileSync(`./cache/${page}`, {
        encoding: "utf-8",
      });
      return html;
    }

    console.log("Miss, Requesting ", url.href);
    setTimeout(()=>{ }, 500);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html",
        "User-Agent":
          "FlyRankInternship-A9/1.0 (https://github.com/Muhammad-Fahad-MF/Books-Scraper)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    writeFileSync(`./cache/${page}`, html, "utf-8");
    return html;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

let current_page = new URL("page-1.html", Site_URL);

for(let i = 1; i <= 3; i++) {
  const html = await ReadHTML(current_page);
  const $ = cheerio.load(html);
  const links: string[] = $(".product_pod > h3 > a")
    .map((_index, item) => $(item).attr("href"))
    .get();
  links.forEach((link) => {
    let url = new URL(link as string, Site_URL);
    discoveredBooks++;
    URLs.add(url);
  });
  links.length = 0;

  const next_href = $('.next > a').attr('href');
  if(next_href && i <= 3) {
      current_page = new URL(next_href, Site_URL);
      catalougesPages++;
  } else {
    break;
  }
};

uniqueBooks = URLs.size;
console.log(`catalogue_pages: ${catalougesPages} \ndiscovered_books: ${discoveredBooks} \nunique_urls: ${uniqueBooks}`);