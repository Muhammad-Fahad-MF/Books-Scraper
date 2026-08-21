## Web Scraper (Books):

This project is my practice of how scrapers work and how to make my own.

---

### Target:

For this project my target is [https://books.toscrape.com/]("https://books.toscrape.com/"), books.toscrape is designed purposefully to serve as a practice for beginners. And It is mentioned on their website that I am free to use their sandbox for my practice. I will collect information on books from first 3 catalouge pages only. For some reason, this website robots.txt is missing, but they have given persmission on their homepage.

## Guide to Install and Running the Scraper:

1. Clone the Project By:  
   `git clone https://github.com/Muhammad-Fahad-MF/Books-Scraper.git`
2. Change the directory By:  
   `cd Book-Scraper`
3. Install All Dependencies By:  
   `npm install`
4. Run the scraper by:  
   `npm run dev`

---

### Tech Stack (Lane):

For the Book Scraper, I used typescript with node js. For schema and data validation, I used zod. And mainly for extracting data from HTML pages, I used cheerio which uses JQuery APIs method to fetch data from HTML pages.

---

#### Schema:

For each individual book record, following is the schema:

```
{
    "title": "Tipping the Velvet",
    "product_url": "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html",
    "price_text": "£53.74",
    "price_gbp": 53.74,
    "availability_text": "In stock (20 available)",
    "rating_text": "One",
    "description": "...",
    "source_page": "https://books.toscrape.com/catalogue/page-1.html",
    "fetched_at": "2026-08-21T08:10:34.885Z"
}
```

---

### Politeness Practices:

I add user agent in my request, so that website owner know from whom that request came as I mentioned this repo link in it. a delay of 1.5 seconds is also added in between each individual request, so that server may not be disturbed by the load. For retry requests 4 seconds of delay is added if there is server's fault (5XX), but no retry on 404 or 403. A timeout of 10 seconds is added if there are latency issues. And the scraper caches each and every page's HTML, so that host server only get 1 request first and then program works from cache files.

---

### Run Report:

Scraper generates a run report after a successfull run, which contains all metrics.  
For Example:

```
{
  "startTime": "2026-08-21T08:10:34.705Z",
  "duration": 3447,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 1
}
```

---

#### Why not a browser:

I did not use any browser framework because the data server sends is in HTML format. so Cheerio is enough because it is lightweight and fast. And browser frameworks would add a bloat to project by adding features which are not necessary for the scope.

---

### Ethics Note:

Scraping is only ok when it does not violate host's permission. So scrape with politness, never bypass logins, paywalls, or blocks, and only take what you need. Rescpect the robot.txt .

---

### Promise:

I will not reuse this code on another website without checking its rules and permission first.
