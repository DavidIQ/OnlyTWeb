# OnlyT Web

Angular operator console and PHP API port of the core OnlyT meeting-timer workflow. The app provides a selectable schedule, start/stop controls, count-up/count-down mode, per-item duration adjustments, a browser-based secondary display, and persistent timer state.

Project home: <https://github.com/DavidIQ/OnlyTWeb>

## Requirements

- Node.js and npm
- PHP 8.1+ with PDO SQLite enabled

## Run locally

Start the API in one terminal:

```powershell
php -S 127.0.0.1:8000 -t backend/public backend/public/router.php
```

In another terminal:

```powershell
npm install
npm start
```

Open the Angular URL printed by the CLI (normally `http://localhost:4200`). The Angular development server proxies `/api` requests to the local PHP server.

The first API request creates `backend/storage/onlyt.sqlite` and seeds the example schedule. Schedule entries and settings are stored in SQLite and survive server restarts. Back up this database file to preserve local changes.

## API

The PHP API retains the OnlyT versioned routes and timer response fields:

- `GET /api/` — supported API version range
- `GET /api/v1/timers` and `GET /api/v1/timers/{talkId}` — timer status and schedule
- `POST /api/v1/timers/{talkId}` — start a timer
- `DELETE /api/v1/timers/{talkId}` — stop a timer
- `PUT /api/v1/timers/{talkId}` — update duration or count direction
- `GET /api/v1/schedule/midweek?isCircuitVisit=` — preview the mid-week schedule
- `POST /api/v1/schedule/midweek` — seed the mid-week schedule (`{isCircuitVisit}`); no-op if already present
- `DELETE /api/v1/schedule/talks/{talkId}` — remove a mid-week part (not the last one, not while a timer runs)
- `GET /api/v1/report` — the sender address and saved recipients. `POST /api/v1/report/email` — sends the HTML progress report (`recipients`, `subject`, `html`, `images`) from `MeetingReport@<host>` with PHP `mail()` and, on success, saves the recipients. The HTML is sanitised server-side. Delivery requires a working mail setup on the server (`sendmail_path` or SMTP in `php.ini`); otherwise the API returns `mail_failed`.
- `GET /api/v1/settings`, `PUT /api/v1/settings` — also hold the meeting settings: `circuitVisit`, `midweekStart`/`midweekEnd`, `weekendDay` (0 = Sunday), `weekendStart`/`weekendEnd` (`HH:MM`), `adaptiveMode` (`none`, `oneWay`, `twoWay`). All are stored in SQLite.

The weekend schedule (Public Talk and Watchtower Study) is built in and needs no import. When the Circuit Overseer visits, the Watchtower Study is shortened to 30 minutes and a 30-minute concluding talk is added; on the mid-week meeting the congregation Bible study is replaced by the Circuit Overseer's service talk, after the concluding comments. Part durations can be adjusted for either meeting.
Error responses include a machine-readable `code` used by the client for translated messages.

## Operator console PIN

The operator console is protected by a 4-digit PIN set in `backend/config.php` (`'pin' => '1234'` by default — change it before deploying). `POST /api/v1/auth` (`{pin}`) validates it and sets a 12-hour HttpOnly session cookie; `GET /api/v1/auth` reports the state. Every non-GET API call and the schedule preview require the cookie (401 `auth_required` otherwise). Reads of timers and settings stay public so `/display` and `/progress` work without a PIN. Five wrong attempts lock logins for one minute. Changing the PIN signs everyone out.

## Setup and display

- The settings panel ("Congregation meetings settings") has Save and Cancel; both close it, Save shows a "Saved successfully" toast, and the segment and schedule are hidden while it is open. The Circuit Overseer checkbox stays on the main screen.
- On first run (no mid-week schedule in SQLite) a setup screen is shown before the operator console, with a preview and an Import button.
- A language picker (English, Spanish, Portuguese, French, Italian) translates all UI text and schedule titles; the choice is stored in the browser.
- `/display` shows only the browser-formatted clock when idle, and the running timer otherwise: green while OK, yellow in the last minute, red when over time. The clock omits AM/PM. A small link leads to `/progress`.
- `/progress` ("Meeting Progress") lists every part of the active meeting in order with its length. Finished parts show actual time, start/end times and a green `-mm:ss` (under) or red `+mm:ss` (over) variance, the running part ticks live, and pending parts are grayed. The mid-week meeting has WOL-styled section headings. Start/end times are recorded when a timer is started and stopped. Both `/display` and `/progress` need the web server to serve `index.html` for those paths.
- Adaptive mode (setting for both meetings, as in the Windows app): when a talk starts, the time the meeting is running ahead or behind (more than 15 s, up to 15 min) is spread over this and the remaining adaptable talks (student talks, Living as Christians, concluding items, Watchtower Study) in proportion to their length. One-way only shortens talks; two-way also lengthens them. The planned timeline is the configured start time plus the cumulative durations and typical changeover gaps, so it is an approximation of the Windows offsets. The server's PHP time zone is used for the clock.
- `GET /api/v1/system`, `GET /api/v1/datetime`

The timer API adds an `elapsedSeconds` field while retaining the existing property names.

## Publish to a server

The client is static files and the API is PHP, so any Linux host with a web server (nginx or Apache), PHP-FPM 8.1+ and the `pdo_sqlite` and `dom` extensions works. For the email report, configure PHP mail (for example a local Postfix/sendmail) and make sure the host may send mail as `MeetingReport@your-domain`. Use HTTPS: the PIN is sent to the server.

1. **Configure.** Set a new PIN in `backend/config.php`. Set the PHP time zone to the congregation's local time (`date.timezone = America/New_York` in `php.ini` or the pool config), because adaptive mode compares the meeting start time with the server clock.
2. **Build the client** on your computer:

   ```powershell
   npm install
   npm run build
   ```

   The static site is created in `dist/onlyt-web/browser`.
3. **Upload** to a layout like this, keeping `backend` outside the web root so `config.php` and the database can't be downloaded:

   ```text
   /var/www/onlyt/
     web/       <- contents of dist/onlyt-web/browser (the web root)
     backend/   <- the backend folder (public/, src/, storage/, config.php)
   ```

4. **Permissions.** PHP-FPM's user must be able to write `backend/storage` (it holds `onlyt.sqlite` and `auth_attempts.json`, created on the first request):

   ```bash
   sudo chown -R www-data:www-data /var/www/onlyt/backend/storage
   sudo chmod 770 /var/www/onlyt/backend/storage
   ```

5. **Web server.** Serve the static site, send `/api` to `backend/public/index.php`, and fall back to `index.html` for every other path so `/display` and `/progress` work when opened directly.

   nginx (adjust the server name, certificate and PHP-FPM socket):

   ```nginx
   server {
       listen 443 ssl;
       server_name onlyt.example.org;
       # ssl_certificate / ssl_certificate_key ...

       root /var/www/onlyt/web;
       index index.html;

       location /api {
           include fastcgi_params;
           fastcgi_param SCRIPT_FILENAME /var/www/onlyt/backend/public/index.php;
           fastcgi_pass unix:/run/php/php8.3-fpm.sock;
       }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

   Apache (with `mod_rewrite`, `mod_proxy_fcgi` and `mod_alias`; adjust the socket):

   ```apache
   <VirtualHost *:443>
       ServerName onlyt.example.org
       # SSLEngine on, SSLCertificateFile ...

       DocumentRoot /var/www/onlyt/web
       <Directory /var/www/onlyt/web>
           Require all granted
           RewriteEngine On
           RewriteCond %{REQUEST_URI} !^/api
           RewriteCond %{REQUEST_FILENAME} !-f
           RewriteRule ^ /index.html [L]
       </Directory>

       Alias /api /var/www/onlyt/backend/public/index.php
       <Directory /var/www/onlyt/backend/public>
           Require all granted
           <FilesMatch "\.php$">
               SetHandler "proxy:unix:/run/php/php8.3-fpm.sock|fcgi://localhost"
           </FilesMatch>
       </Directory>
   </VirtualHost>
   ```

6. **Check it.** Open `https://onlyt.example.org/api/` (it should return `{"lowVersion":1,"highVersion":4}`), then the site root, which asks for the PIN. Open `/display` on the projector or second screen.

**Updating.** Rebuild, then replace the contents of `web/` and the `backend/public` and `backend/src` folders. Don't overwrite `backend/storage` (your schedule, settings and timings) or `backend/config.php` (your PIN). Database changes are applied automatically on the next request. To back up, copy `backend/storage/onlyt.sqlite`.

## Port scope

The port covers the schedule/operator timer and browser display. WPF window placement, NDI output, adaptive-meeting feeds, desktop notifications, and the original LiteDB timing reports are Windows desktop features and are not implemented in this web version.

For development, bind PHP to `127.0.0.1` as shown above. Before exposing the app on a network, follow [Publish to a server](#publish-to-a-server): use HTTPS and change the default PIN.

## Credits

OnlyT Web is based on [OnlyT](https://github.com/AntonyCorbett/OnlyT), the Windows meeting timer created by Antony Corbett and released under the MIT license. The original copyright notice is kept in [LICENSE](LICENSE). Thank you, Antony, for the original app.
