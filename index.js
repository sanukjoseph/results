const express = require('express');
const { load } = require('cheerio');
const ejs = require('ejs');
const path = require('path');


const app = express();
const port = 3000;
const url = 'https://dsdc.mgu.ac.in/exQpMgmt/index.php/public/ResultView_ctrl/index';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));


const extractOptions = (html) => {
  const optionsSet = new Set();
  const options = [];
  const $ = load(html);
  $("#exam_id option").each((_, element) => {
    const id = $(element).attr('value');
    const value = $(element).text().trim();

    if (id && value && !optionsSet.has(id)) {
      optionsSet.add(id);
      options.push({ id, value });
    }
  });
  return options;
};

const validateParams = (req, res, next) => {
  const { examId, rollNo } = req.params;
  if (!examId || isNaN(parseInt(examId)) || !rollNo || isNaN(parseInt(rollNo))) {
    return res.status(400).send('Invalid parameters');
  }
  next();
};

const getResultHTML = ($) => {
  const $fieldset = $("fieldset.frame");
  const $tables = $fieldset.find("table");

  if ($tables.length > 1) {
    $tables.slice(3).remove();
    $tables.each((index, table) => {
      const $table = $(table);
      const $noPrintRows = $table.find("tr.noPrint");
      if ($noPrintRows.length > 0) {
        const startIndex = $table.find("tr").index($noPrintRows.first());
        $table.find("tr").slice(startIndex).remove();
      }
    });
  }

  $fieldset
    .find(".bord_rslt")
    .removeAttr("class")
    .css({
      border: "solid 1px #333",
      "border-collapse": "inherit",
      "background-color": "#FFF",
    })
    .end()
    .removeAttr("style");

  return $.html().replace(/\s+/g, ' ');
};


app.get('/', async (req, res) => {
  try {
    const response = await fetch(url);
    const data = await response.text();
    const options = extractOptions(data);

    res.render('index', { exams: options });
  } catch (error) {
    res.status(500).send('Error fetching options');
  }
});

app.get('/options', async (req, res) => {
  try {
    const response = await fetch(url);
    const data = await response.text();
    const options = extractOptions(data);
    res.send(options);
  } catch (error) {
    res.status(500).send('Error fetching options');
  }
});

app.get('/result/:examId/:rollNo', validateParams, async (req, res) => {
  const { examId, rollNo } = req.params;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: `exam_id=${parseInt(examId)}&prn=${parseInt(rollNo)}&btnresult=Get Result`,
    });
    const $ = load(await response.text());
    $("form, .header, .footer, .link_black, style, title, meta, script").remove();
    $("*").contents().filter((_, element) => element.nodeType === 8).remove();
    $("table").removeAttr("style");
    const resultHTML = getResultHTML($);
    res.send(resultHTML);
  } catch (error) {
    res.status(500).send('Error fetching result');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
