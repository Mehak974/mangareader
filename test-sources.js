const { SOURCE_SCRAPERS } = require('./backend/extractors/universalExtractor.js');

(async () => {
  console.log('=== ALL SOURCES TEST ===');
  let totalPassed = 0, totalFailed = 0;

  for (const [sourceId, source] of Object.entries(SOURCE_SCRAPERS)) {
    console.log(`\n${'='.repeat(sourceId.length + 30)}`);
    console.log(`  ${sourceId.toUpperCase()} (Manga${source.name ? ' - ' + source.name : ''})`);
    console.log('='.repeat(sourceId.length + 30));

    let sourcePassed = 0, sourceFailed = 0;

    // Test 1: getHome
    process.stdout.write('[1] getHome() ... ');
    try {
      const home = await source.getHome();
      if (home?.items?.length > 0) {
        console.log(`OK (${home.items.length} items)`);
        sourcePassed++;
      } else {
        console.log('FAIL (0 items)');
        sourceFailed++;
      }
    } catch (e) {
      console.log('FAIL:', e.message);
      sourceFailed++;
    }

    // Test 2: getMangaDetail
    process.stdout.write('[2] getMangaDetail() ... ');
    const detailUrls = {
      mangaread: 'https://www.mangaread.org/manga/academys-genius-swordmaster/',
      mangadex: 'https://mangadex.org/title/b70113a5-32a3-44e8-a28f-0e88392808ba/one-piece',
      mangakatana: 'https://mangakatana.com/manga/baki-rahen.27070/',
      manganato: 'https://www.manganato.gg/manga/martial-peak/',
    };
    let detail = null;
    try {
      detail = await source.getMangaDetail(detailUrls[sourceId] || '');
      if (detail?.chapters?.length > 0) {
        console.log(`OK (${detail.chapters.length} chapters, ${detail.title || 'unknown'})`);
        sourcePassed++;
      } else {
        console.log('FAIL (0 chapters)');
        sourceFailed++;
      }
    } catch (e) {
      console.log('FAIL:', e.message);
      sourceFailed++;
    }

    // Test 3: getChapterImages
    process.stdout.write('[3] getChapterImages() ... ');
    if (detail?.chapters?.length > 0) {
      try {
        const img = await source.getChapterImages(detail.chapters[0].href);
        if (img.images.length >= 3) {
          console.log(`OK (${img.images.length} images)`);
          sourcePassed++;
        } else {
          console.log(`FAIL (${img.images.length} images, need >= 3)`);
          sourceFailed++;
        }
      } catch (e) {
        console.log('FAIL:', e.message);
        sourceFailed++;
      }
    } else {
      console.log('SKIP (no chapters)');
      sourceFailed++;
    }

    console.log(`  -> ${sourcePassed} passed, ${sourceFailed} failed`);
    totalPassed += sourcePassed;
    totalFailed += sourceFailed;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  process.exit(totalFailed > 0 ? 1 : 0);
})();
