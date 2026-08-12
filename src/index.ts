import { readdirSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";


const Site_URL: string = "https://books.toscrape.com";


const RequestFromSite = async (page: string) => {
    try{
        const files = readdirSync("./cache");
        if(files.includes(page)){
            console.log("Hit!");
            return;
        }
        console.log("Miss, Requesting ", page);
        const response = await fetch(`${Site_URL}/catalogue/${page}`, {
            method: "GET",
            headers: {
                "Accept": "text/html",
                "User-Agent": "FlyRankInternship-A9/1.0 (https://github.com/Muhammad-Fahad-MF/Books-Scraper)"
            },
            signal: AbortSignal.timeout(8000)
        });
        
        if(!response.ok){
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        await writeFile(`./cache/${page}`, html, 'utf-8')
    }
    catch (err) {
        console.error(err);
    }
}

// for (let i = 1; i < 4; i++){
//     let page = `page-${i}.html`;
//     RequestFromSite(page);
// } 
const html = readFileSync("./cache/page-1.html", {
    encoding: 'utf-8'
});
console.log('here!');
const $ = cheerio.load(html);
let title = $('h3 a').text();
console.log(title);