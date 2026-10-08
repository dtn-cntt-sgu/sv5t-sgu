import { expect, test } from "@playwright/test";

const pages = [
  { path: "/login", headings: ".auth-aside h2, .auth-heading h1, .auth-quote" },
  { path: "/register", headings: ".register-intro h1, .form-title h2" },
];

for (const { path, headings } of pages) {
  test(`${path}: Vietnamese letters and accents use one complete bundled face`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);

    const faces = await page.locator(headings).evaluateAll(async (elements) => {
      const alphabet =
        "ĐđĂăÂâÊêÔôƠơƯư" +
        Array.from({ length: 0x1efa - 0x1ea0 }, (_, index) =>
          String.fromCodePoint(0x1ea0 + index),
        ).join("");
      return Promise.all(
        elements.map(async (element) => {
          const style = getComputedStyle(element);
          const family = style.fontFamily.split(",")[0];
          const font = `${style.fontStyle} ${style.fontWeight} 32px ${family}`;
          const nfc = await document.fonts.load(font, alphabet);
          const nfd = await document.fonts.load(
            font,
            alphabet.normalize("NFD"),
          );
          return {
            nfc: nfc.map((face) => ({
              range: face.unicodeRange,
              status: face.status,
            })),
            nfd: nfd.map((face) => ({
              range: face.unicodeRange,
              status: face.status,
            })),
          };
        }),
      );
    });
    for (const face of faces) {
      // A split Latin/Vietnamese font would resolve to multiple restricted faces.
      expect(face.nfc).toEqual([{ range: "U+0-10FFFF", status: "loaded" }]);
      expect(face.nfd).toEqual(face.nfc);
    }
  });

  for (const blockFonts of [false, true]) {
    test(`${path}: headings fit desktop and mobile ${blockFonts ? "with fallback fonts" : "with bundled fonts"}`, async ({
      page,
    }) => {
      if (blockFonts) {
        await page.route("**/*.{woff,woff2,ttf,otf}", (route) => route.abort());
      }
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 375, 768, 980, 1024, 1280, 1536, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const metrics = await page.locator(headings).evaluateAll((elements) =>
          elements
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => ({
              text: element.textContent,
              width: element.clientWidth,
              scrollWidth: element.scrollWidth,
            })),
        );
        for (const metric of metrics) {
          expect(
            metric.scrollWidth,
            `${width}px: ${metric.text}`,
          ).toBeLessThanOrEqual(metric.width + 1);
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        expect(overflow, `${width}px: page overflow`).toBeLessThanOrEqual(1);
      }
    });
  }
}
