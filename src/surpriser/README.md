# Surpriser – webes nézet

A Surpriser webes változata a sengdev.com/apps/surpriser címen: telepítés nélkül látszanak a családtagok listái, névtelenül lehet foglalni, a saját lista is kezelhető (kívánságok, sorrend, „Megkaptam”, privát kívánság, meghívás), van ajándéktervező (`#/tervezo`) a saját, a gyerekek és a közös listákra, és a gyerekek is kezelhetők, mint az appban (gyerek hozzáadása, szerkesztése, törlése, társszülő, a gyerekek és a testvérek közös listáinak szerkesztése, „Kié?” választó a szerkesztőben), és a fiók is törölhető (`#/fiok-torlese`, az app `deleteAccountData`-jának portja: újrahitelesítés, adatok, majd a fiók). A háttér ugyanaz a Firebase-projekt (`surpriser-d3491`), mint az Android-appé, a jogosultságokat a `firestore.rules` kényszeríti ki.

## Oldalak

| Útvonal | Fájl |
|---|---|
| `/apps/surpriser` | `src/pages/apps/surpriser/index.astro` → `ui/App.tsx` (Preact-sziget, `client:only`) |
| `/apps/surpriser/adatvedelem` | `src/pages/apps/surpriser/adatvedelem.astro` (Play Console: Privacy policy URL) |
| `/apps/surpriser/meghivo?tol=…&cim=…` | `src/pages/apps/surpriser/meghivo.astro` – meghívó link céloldala (statikus, csak megjelenít) |
| `/apps/surpriser/fiok-torlese` | `src/pages/apps/surpriser/fiok-torlese.astro` (Play Console: Delete account URL) |
| `/apps/surpriser/bovitmeny` | `src/pages/apps/surpriser/bovitmeny.astro` – a Chrome-bővítmény: leírás, letöltés (`public/apps/surpriser/surpriser-chrome-<verzió>.zip`), telepítés, könyvjelző-gomb. Verzió és bookmarklet: `src/surpriser/extension/`. A bővítmény forrása külön repó: `~/Documents/Repo/surpriser-chrome`. |

Az app belső útvonalai hash-alapúak (`#/kivansag/<id>`, `#/foglalasaim`, `#/uj-kivansag[/<lista>]`, `#/sajat/<id>`, `#/meghivas`, `#/tervezo`, `#/uj-terv[/<lista>][?nev=…]`, `#/terv/<id>`, `#/uj-gyerek`, `#/gyerek/<id>`, `#/tarsszulo/<id>`, `#/fiok-torlese`), így a Cloudflare-en nem kell átirányítás.

## Privát kívánságok

Ajándékozóként tulajonként két lekérdezés fut (`audience array-contains 'public'` és `array-contains <uid>`), mert a szabályok csak ilyet engednek; a saját és a saját gyerekek listáján egy teljes lekérdezés. Ehhez kell az `ownerId` + `audience` összetett index (az Android-projekt `firestore.indexes.json`-jában).

## Felépítés

- `config.ts` – Firebase web config, adatkezelő adatai
- `data/authService.ts` – belépés, regisztráció, megerősítés, Google (`signInWithPopup`) és fiók-összekötés
- `data/storeService.ts` – Firestore-lekérdezések és -írások, a szabályok által elvárt alakban (az app `FirestoreDataSource`-ának megfelelői)
- `data/board.ts` – kit lát a felhasználó (az app `buildPeopleSnapshot`-jának portja), mely listákat szerkesztheti, és élő feliratkozások
- `data/children.ts` – a gyerekekkel kapcsolatos ellenőrzések (az app `ChildUseCases`-ének portja)
- `data/familyPublisher.ts` – ki láthatja a gyerekeimet (`viewerEmails`, `familyBy`), mint az app `SyncEngine`-jében
- `ui/` – képernyők: belépés, Kívánságlisták, kívánság részletei, Foglalásaim

## Élesítés

1. Firebase Console → Project settings → **Add app → Web**, a kapott értékeket írd be a `config.ts`-be (`apiKey`, `messagingSenderId`, `appId`).
2. Authentication → Settings → **Authorized domains**: `sengdev.com` és a Cloudflare Pages előnézeti domainje.
3. Ha az App Check kikényszerítés bekapcsol: a webhez reCAPTCHA Enterprise provider kell (még nincs a kódban).

## Helyi futtatás

`pnpm dev`, majd http://localhost:4321/apps/surpriser. A `localhost` alapból engedélyezett domain, így a valódi projekttel is működik. Emulátorral: `PUBLIC_SURPRISER_EMULATOR=1 pnpm dev` (Auth: 9099, Firestore: 8080).

## Meghívó link

Az app nem küld e-mailt (a Firebase Spark csomagban a linkes belépés napi 5 e-mailre korlátozott). A meghívó a „Meghívó küldése” gombbal a telefon megosztó menüjén küldi el a linket: `https://sengdev.com/apps/surpriser/meghivo?tol=<név>&cim=<e-mail>`. A céloldal kitölti az e-mail-címet a regisztrációnál/belépésnél (`/apps/surpriser?cim=…&mod=regisztracio`). A link nem ad jogot semmihez: a meghívás a Firestore-ban van, az e-mail-címhez kötve.

## Kitöltött tervszerkesztő linkből

A Chrome-bővítmény és a könyvjelző-gomb (bookmarklet) a termékoldalról kiolvasott adatokkal nyitja meg az új terv szerkesztőjét:

```
/apps/surpriser/#/uj-terv[/<lista>]?nev=…&ar=…&leiras=…&kep=…&link=…
```

A paramétereket a `prefill.ts` tisztítja a szabályok korlátaira: név ≤ 200, leírás ≤ 2000 karakter (karakter közepén nem vág), ár egész forint 1–100 000 000 (`12 990 Ft`, `12.990,-`, `12 990,00 HUF` is jó), kép és link csak `http(s)`, ≤ 2000 karakter. Ami nem fér bele vagy nem értelmezhető, üresen marad. A szerkesztő tetején jelzés mutatja, hogy az adatok a termékoldalról jöttek; **semmi nem mentődik magától**. Mentés után a Tervező nyílik. Kijelentkezve a hash megmarad, belépés után a kitöltött szerkesztő jön.

## Apple-belépés

A kód kész, de a gomb rejtve van (`APPLE_SIGN_IN_ENABLED` a `config.ts`-ben), mert fizetős Apple Developer tagság kell hozzá (Services ID, kulcs).

## Kezdőképernyő

`public/apps/surpriser/manifest.webmanifest` + Apple meta tagek; iPhone-on egyszer megjelenik egy tipp a „Főképernyőhöz adás”-ról.
