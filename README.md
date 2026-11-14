# Tara Bataan

A business directory for Bataan. Visitors browse resorts, food, tours and local services. Business owners log in with their email, add their listing, and pay to be Featured or Premium. You approve listings and switch on paid plans from the admin page.

**Runs on:** Supabase (database, logins, photos) + Cloudflare Pages (hosting, free) + GitHub (stores the code).

---

## What's in this folder

| File | What it does |
|---|---|
| `index.html`, `js/home.js` | Homepage: Stay / Things to do / Eat / Pasalubong, search, town filter |
| `functions/b/[slug].js` | Each business's own page at `/b/business-name`, built on the server so Google can read it |
| `functions/sitemap.xml.js` | `/sitemap.xml`, the list of pages you give Google |
| `list-your-business.html` | Pricing page for owners |
| `login.html` | Email login link (no passwords) |
| `account.html`, `js/account.js` | Owner dashboard: add/edit listing, photos, views and clicks, messages from visitors |
| `admin.html`, `js/admin.js` | Your admin page: approve, send back, pause, set plans, log GCash payments |
| `js/config.js` | **Your settings: Supabase keys, GCash details, contact email** |
| `supabase/schema.sql` | Creates the whole database. Run once |
| `supabase/make-me-admin.sql` | Makes your account the admin. Run once, after your first login |

---

## Already done for you
- The database is set up in your Supabase project **leyquidit-glitch's Project** (ID `erpxcsmlglnglpxsiboo`, Tokyo region). Tables, security rules and the photo bucket are in, and the security rules were tested.
- `js/config.js` already has your Supabase URL, key and GCash details.

So skip steps 1 and 2 below and start at step 3. You can rename the project to `tara-bataan` under Supabase → Project Settings → General.

For step 4, the two Cloudflare environment variables are:
- `SUPABASE_URL` = `https://erpxcsmlglnglpxsiboo.supabase.co`
- `SUPABASE_ANON_KEY` = the long `SUPABASE_ANON_KEY` value in `js/config.js` (copy it without the quotes)

## Setup (about 30–45 minutes)

### 1. Create the Supabase project
1. Go to supabase.com → **New project**. Name it `tara-bataan`, pick the **Singapore** region (closest to the Philippines), and save the database password somewhere safe.
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**. You should see "Success. No rows returned."
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.

### 2. Fill in your settings
Open `js/config.js` and replace:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the two values from step 1.3
- `CONTACT_EMAIL`, `GCASH_NAME`, `GCASH_NUMBER` with your own

The anon key is safe to put in the website. The security rules in `schema.sql` decide what each person can see and change.

### 3. Put the code on GitHub
Create a new repository called `tara-bataan` and upload all the files in this folder, keeping the same folders (`js`, `functions`, `server`, `supabase`).

### 4. Deploy on Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick `tara-bataan`.
2. Build settings: **Framework preset: None**, **Build command: leave empty**, **Build output directory: `/`**.
3. Before you deploy, open **Environment variables** and add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon key

   (The business pages and sitemap run on Cloudflare's server, so they need these too.)
4. Click **Save and Deploy**. You'll get a link like `tara-bataan.pages.dev`.

### 5. Connect the login emails to your site
In Supabase → **Authentication → URL Configuration**:
- **Site URL**: your site, e.g. `https://tarabataan.com` (or the `.pages.dev` link for now)
- **Redirect URLs**: add `https://tarabataan.com/**` and `https://tara-bataan.pages.dev/**`

Optional but nice: **Authentication → Email Templates → Magic Link**, and change the wording to mention Tara Bataan.

### 6. Make yourself the admin
1. Open your site → **Log in** → enter your email → click the link in your inbox.
2. In Supabase **SQL Editor**, open `supabase/make-me-admin.sql`, put your email in, and **Run**.
3. Refresh the site. You'll now see **Admin** in the menu.

### 7. Add your domain (when you've bought it)
Cloudflare Pages → your project → **Custom domains → Set up a domain** → `tarabataan.com`. If you buy the domain from Cloudflare, this is one click. Then update the Site URL in step 5, and the `Sitemap:` line in `robots.txt` if you use a different domain.

### 8. Tell Google about it
Go to Google Search Console, add your domain, and submit `https://tarabataan.com/sitemap.xml`.

---

## Free mode (on right now)
`FREE_MODE: true` in `js/config.js` makes listing free for everyone: no plan picker, no GCash step, no Upgrade button, and every owner can add up to 10 photos. When you're ready to charge, change it to `false` and upload `js/config.js` to GitHub again. Nothing else needs to change.

You can still make any business Featured or Premium for free from Admin → Plan & payment → Paid by: Free / promo.

## How the money works (when free mode is off)

1. An owner adds a listing and picks Featured or Premium. They see your GCash details on screen.
2. They pay you by GCash and send the receipt.
3. In **Admin → Asked to upgrade**, click **Plan & payment**: choose the plan and number of months, enter the amount and GCash reference, and **Save**.
4. The listing becomes Featured or Premium right away and **switches back to Basic on its own** after the end date. The admin page shows plans ending within 7 days so you can remind owners to renew.

Doing payments by hand keeps it simple while you have only a few paying businesses. When you have more, the next step is PayMongo checkout so owners pay with GCash or a card online and the plan switches on automatically. PayMongo needs a registered business (DTI or SEC) to go live.

---

## Before you launch: things to know

- **Login emails:** Supabase's built-in email only sends a few login emails per hour. Before you invite lots of owners, connect a free Resend account under **Authentication → SMTP Settings** so emails send reliably and come from your own domain.
- **Messages from visitors** appear on the owner's **My listings** page. Owners aren't emailed about them yet, so tell owners to check their dashboard, or add email alerts later.
- **Edits:** once a listing is approved, owner edits go live straight away. Listings you sent back go to review again when the owner edits them.
- **Travel guides:** the homepage section is hidden until you add guides. Write each one as an HTML page in a `guides` folder, then add it to the `GUIDES` list at the top of `js/home.js`.
- **Free hosting limits:** Supabase's free plan pauses a project after a week with no activity. Once the site has real visitors this won't happen, but check on it while you're still testing. Cloudflare Pages is free for this kind of site.
- **Privacy:** visitors' names and numbers in messages are personal data. Add a short privacy notice to the footer before launch, in line with the Data Privacy Act.

## Ideas for next versions
- PayMongo online payments with automatic renewals
- Email alerts to owners for new messages, and renewal reminders
- Visitor reviews and ratings
- A map view of all listings
- Owners claiming listings you added yourself
