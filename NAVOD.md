# Pop-Up Card Creator — Návod na použitie

Webová aplikácia, ktorá z nahratého obrázka (auto, lietadlo, zviera...) vygeneruje viacvrstvovú 3D pop-up kartu v štýle kirigami. Výsledné šablóny si môžete stiahnuť ako SVG a vyrezať z papiera.

## Spustenie

Aplikácia beží čisto v prehliadači, nepotrebuje žiadny backend. Stačí spustiť lokálny server:

```bash
cd ~/popup-card-creator
python3 -m http.server 8080
```

Potom otvoriť v prehliadači: **http://localhost:8080**

## Postup — krok za krokom

### 1. Nahrať obrázok

- Kliknite na **"Nahrať obrázok"** v hlavičke, alebo pretiahnite obrázok priamo do šedej zóny vľavo.
- Podporované formáty: PNG, JPG, WebP a ďalšie bežné obrázkové formáty.
- Obrázok sa automaticky zmenší na max 800px (kvôli rýchlosti spracovania).

**Tip:** Najlepšie výsledky dosiahnete s obrázkom, kde je objekt jasne odlíšiteľný od pozadia — ideálne silueta na jednofarebnom pozadí alebo PNG s priehľadnosťou.

### 2. Nastaviť extrakciu pozadia

Po nahratí sa obrázok automaticky spracuje a zobrazí sa čiernobiela maska (biela = objekt, čierna = pozadie). Ak maska nevyzerá dobre, upravte nastavenia:

#### Metóda extrakcie pozadia

Ako aplikácia rozpozná, čo je objekt a čo pozadie:

| Metóda | Kedy použiť |
|--------|-------------|
| **Auto** (predvolená) | Väčšina obrázkov. Predpokladá, že rohy obrázka sú pozadie a "vylieva" ho odtiaľ dovnútra. |
| **Alpha kanál** | PNG obrázky s priehľadným pozadím. Použije priamo priehľadnosť. |
| **Klik na farbu pozadia** | Zložitejšie obrázky. Po zvolení tejto metódy kliknite na obrázok na miesto, ktoré je pozadie — aplikácia tú farbu odstráni. |

#### Tolerancia (1–100)

Určuje, ako prísne sa posudzuje, čo je ešte pozadie:

- **Nízka hodnota (1–20):** Presné — odstráni len pixely veľmi podobné farbe pozadia. Môže nechať zvyšky pozadia okolo objektu.
- **Stredná hodnota (20–50):** Dobrý kompromis pre väčšinu obrázkov.
- **Vysoká hodnota (50–100):** Agresívne — odstráni aj odtiene podobné pozadiu, ale môže "zožrať" aj časti samotného objektu.

Maska sa aktualizuje okamžite pri posúvaní slideru, takže jednoducho experimentujte.

### 3. Nastaviť parametre vrstiev

#### Počet vrstiev (3–8)

Koľko "plátov" bude mať výsledná pop-up karta:

- **3–4 vrstvy:** Jednoduchá karta, ľahšie na vyrezanie, menej výrazný 3D efekt.
- **5 vrstiev** (predvolené): Dobrý pomer medzi efektom a náročnosťou.
- **6–8 vrstiev:** Veľmi detailná karta s výrazným efektom hĺbky, ale vyrezanie zaberie viac času.

#### Sila erózie (3–20)

O koľko pixelov sa každá ďalšia vrstva zmenší oproti predchádzajúcej:

- **Malá hodnota (3–6):** Vrstvy sú si veľmi podobné, jemné rozdiely. Výsledný efekt hĺbky je subtílny.
- **Stredná hodnota (7–12):** Viditeľné rozdiely medzi vrstvami, dobre vyzerá vo väčšine prípadov.
- **Veľká hodnota (13–20):** Dramatické rozdiely — predná vrstva je výrazne menšia ako zadná. Pozor, pri malom objekte môžu vnútorné vrstvy úplne zmiznúť.

#### Farby vrstiev

Farebné štvorčeky umožňujú zmeniť farbu každej vrstvy v 3D náhľade. Slúžia len na vizualizáciu — nemajú vplyv na exportované SVG šablóny (tie sú vždy čiernobiele, na vyrezanie).

### 4. Generovať vrstvy

Kliknite na **"Generovať vrstvy"**. Zobrazí sa progress bar s aktuálnym krokom:

1. Príprava masky
2. Erózia jednotlivých vrstiev
3. Generovanie náhľadov
4. Stavba 3D modelu

**Čas spracovania** závisí od nastavení:

| Nastavenie | Odhadovaný čas |
|---|---|
| Typické (5 vrstiev, erózia 8) | 2–5 sekúnd |
| Ťažké (8 vrstiev, erózia 20) | 10–30 sekúnd |

### 5. 3D náhľad

Po vygenerovaní sa vpravo zobrazí interaktívny 3D náhľad pop-up karty:

- **Otáčanie:** Ťahajte myšou (ľavé tlačidlo).
- **Zoom:** Koliesko myši.
- **Posúvanie:** Ťahajte myšou (pravé tlačidlo).
- **Otvorenie karty:** Slider pod náhľadom (0° = zatvorená, 180° = úplne otvorená).
- **Animácia:** Tlačidlo "Animácia" automaticky otvára a zatvára kartu v slučke.

V spodnej časti stránky sa zobrazí pás s náhľadmi jednotlivých vrstiev.

### 6. Export SVG šablón

Kliknite na **"Exportovať SVG"** v hlavičke. Stiahne sa ZIP archív obsahujúci:

- **layer-1.svg, layer-2.svg, ...** — Každá vrstva ako samostatný SVG súbor.
- **all-layers.svg** — Všetky vrstvy vedľa seba na jednom liste.

Každý SVG súbor obsahuje:
- **Plná čiara** — línia rezu (tu vyrezať).
- **Čiarkovaná čiara** — línia ohybu (fold tab, tu ohnúť a prilepiť na základ karty).

Šablóny sú v mierke 150 x 200 mm. Stačí vytlačiť na papier a vyrezať.

## Tipy pre najlepšie výsledky

- **Začnite s jednoduchou siluetou** (napr. auto z boku, strom, zviera) na jednofarebnom pozadí.
- **PNG s priehľadnosťou** dáva najčistejšiu masku bez ladenia tolerancie.
- Ak maska nie je dobrá, skúste najprv zmeniť **metódu extrakcie** a až potom ladiť toleranciu.
- Pri veľkej erózii a malom objekte sa vnútorné vrstvy môžu "stratiť" — znížte silu erózie alebo počet vrstiev.
- Po zmene nastavení kliknite znovu na **"Generovať vrstvy"** — zmena sliderov sama o sebe neregeneruje vrstvy (okrem tolerancie, ktorá aktualizuje masku okamžite).

## Technické požiadavky

- Moderný prehliadač (Chrome, Firefox, Edge, Safari).
- JavaScript musí byť povolený.
- Všetko beží lokálne v prehliadači — žiadne dáta sa nikam neodosielajú.
