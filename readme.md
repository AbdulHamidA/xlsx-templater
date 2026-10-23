中文文档请参考 [readme.zh-cn.md](readme.zh-cn.md)

> **This repository is `xlsxtemplater-dms`, a fork of [`@sailimuhu/xlsxtemplater`](https://github.com/yangguichun/xlsx-templater) 1.2.1 maintained for the DocumentService-DMS project.**
> It keeps the whole template engine and changes only image handling: `{%image}` values are resolved through a pluggable `imageLoader` (Buffers, `data:` URLs or a guarded `fetch`), failures surface through an `onImageError` hook instead of `console.error`, and the `node-fetch` dependency and the browser / ESM bundles are gone. Node.js 18+ only.
> See [Render options](#render-options-dms-fork) below and [NOTICE](NOTICE) for the list of modified files.

# What is xlsxtemplater
xlsxtemplater uses JavaScript Object or JSON as data input to render an xlsx file.

xlsxtemplater is based on the concepts of tags, and each type of tag exposes a feature to the user writing the template.

xlsxtemplater's tag is compatible with the [docxtemplater's xlsx module](https://docxtemplater.com/modules/xlsx/#loops), but only supports a subset of the tag grammar. The most important thing is that xlsxtemplater is free.

xlsxtemplater is built on top of [ExcelJS](https://github.com/exceljs/exceljs), a robust library for reading, manipulating and writing Excel files.

# Installation

This fork is not published to npm. Build it from a clone and install the packed tarball in the consuming project:

```bash
git clone https://github.com/AbdulHamidA/xlsx-templater.git
cd xlsx-templater
npm install
npm run build          # rebuilds dist/xlsxtemplater.cjs from src/
npm pack               # -> xlsxtemplater-dms-<version>.tgz

# in the consuming project
npm install ./xlsxtemplater-dms-<version>.tgz
```

The upstream package remains available as `@sailimuhu/xlsxtemplater` if you do not need the image-loading changes.

## Dependencies
- ExcelJS: ^4.4.0
- Node.js >= 18 (global `fetch`, `AbortController`, `Buffer`)

## Usage

### Node.js (CommonJS)
```javascript
const XlsxTemplater = require('xlsxtemplater-dms');

// From a file on disk: returns the rendered ExcelJS workbook
const workbook = await XlsxTemplater.renderFromFile('./template.xlsx', data);
await workbook.xlsx.writeFile('./result.xlsx');

// From a Buffer: returns the rendered xlsx as a Buffer
const result = await XlsxTemplater.renderFromBuffer(templateBuffer, data, [], {
  imageLoader: async (value, tag, ctx) => ({ buffer: myBytesFor(value), extension: 'png' }),
  onImageError: (err, ctx) => { throw err; }
});
```

Both functions take `(source, data, worksheetNameList = [], options = {})`. An empty `worksheetNameList` renders every worksheet. `options` is described under [Render options](#render-options-dms-fork).

The upstream ESM (`import`) and browser (UMD) builds are not part of this fork; only the CommonJS bundle `dist/xlsxtemplater.cjs` is shipped.

# Quick Start
```javascript
const XlsxTemplater = require('@sailimuhu/xlsxtemplater');

// Create a new instance with your template file
const templater = new XlsxTemplater('./template.xlsx');

// Render with your data
await templater.render({
  company: 'Acme Corp',
  date: '2024-03-20',
  items: [
    { name: 'Item 1', price: 100 },
    { name: 'Item 2', price: 200 }
  ]
});

// Save the rendered file
await templater.save('./output.xlsx');
```

The supported tags: 
- normal tag, `{tagName}`
- loop tag, `{#loopTag} ... {/loopTag}`
- innerloop tag, `{#loopTag} ... {/}`
- image tag, `{%imageTag}`

Extended tag:
- object tag, `{@tagName} ...{/tagName}`, for using nested objects in JSON data.

# How to Use
## Summary
Simply put, it supports 5 types of tags: `normal tag`, `object tag`, `loop tag`, `innerloop tag`, and `image tag`.
- `normal tag` and `innerloop tag` are the most flexible, can be nested inside `object tag` and `loop tag`.
- `loop tag` can contain nested `object tag`, `innerloop tag`, `image tag`, but cannot nest another `loop tag`.
- `object tag` can contain nested `object tag`, `image tag`, `innerloop`, but cannot nest `loop tag`, and can span multiple rows.

## Example
Here's the basic usage.
The following example demonstrates all supported data formats:
```js
let XlsxTemplater = require('XlsxTemplater')
let templater = new XlsxTemplater('./data/month_sale_report.xlsx')
templater.render({
    company: 'Huajie',
    createTime: '2022-12-09 05:25:00',
    reporters: ['Zhangsan', 'Lisi'],
    summary:{
        salesAmount: 5200000,
        newCustomer: 3,
        orderAmount: 6200000,
        productList: ['productA', 'productB', 'productC']
    }, 
    orders: [
        {
            date: '2022-11-1', 
            number: 'X221101001',
            customer: 'dazu',
            products: ['productA', 'productB'],
            salesAmount: 520000,
            remark: ''
        },
        {
            date: '2022-11-3', 
            number: 'X221103002',
            customer: 'vivo',
            products: ['productA', 'productC'],
            salesAmount: 320000,
            remark: ''
        }
    ]
})
```

[继续下一部分...]

# Tag Grammar
## 1. Normal Tag, `{xxx}`
Use curly braces to enclose a field name, like this:
```js
{someTag}
```

| {hostCompany} |{createTime}|{productList}|
|:-|:-|:-

Data:
```js
templater.render({
  hostCompany: 'Huajie',
  createTime: '2022-12-09 05:25:00',
  productList:['productA', 'productB']
})
```
After rendering, note that productList is an array and will be converted to a comma-separated string:

|  Huajie  | 2022-12-09 05:25:00 |'productA', 'productB'
|:-|:-|:-

### Auto-filling Empty String for Missing Tags
In the template below, if the 'remark' field is missing from the actual data, it will be replaced with an empty string:

| {hostCompany} |{createTime}|{remark}|
|:---|:---|:---|

```js
templater.render({
  hostCompany: 'Huajie',
  createTime: '2022-12-09 05:25:00'
})
```
After rendering:

|  Huajie  | 2022-12-09 05:25:00 ||
|:---|:----|:---|

## 2. Loop Tag, `{#xxx}...{/xxx}`
Loop tags are used to generate content from array data. They support both single-line and multi-line loops.
A loop tag consists of start and end tags:
- Start tag: begins with `#` inside curly braces, e.g., `{#someTag}`
- End tag: begins with `/` inside curly braces, e.g., `{/someTag}`

### 2.1 Single-line Loop
Single-line loops have start and end tags on the same line, used for simple array data:
```js
{#items} {name}| {quantity} | {@price}{value} {type}{/price} | {/items}
```

Example data:
```js
templater.render({
    items: [
        {
            name: "Product A",
            quantity: 5,
            price: {
                type: "currency",
                value: 10,
            },
        },
        {
            name: "Product B",
            quantity: 1,
            price: {
                type: "currency",
                value: 20,
            },
        },
    ],
});
```

Result:
|Product A | 5 | 10 currency|
|:-|:-|:-
|Product B | 1 | 20 currency|

### 2.2 Multi-line Loop
Multi-line loops allow start and end tags to be on different rows, useful for repeating blocks of content:

| Description | Action | Responsible |
|------------|--------|-------------|
| {#defects}{description} | {rectify_plan} | {responsible_party.name} |
| Contact: {responsible_party.tel} | | |
| Result: {rectify_result} {/defects}|| |

Example data:
```js
{
  defects: [
    {
      description: 'Issue 1',
      rectify_plan: 'Fix 1',
      rectify_result: 'Completed',
      responsible_party: {
        name: 'Zhang San',
        tel: '13800000001'
      }
    },
    {
      description: 'Issue 2',
      rectify_plan: 'Fix 2',
      rectify_result: 'In Progress',
      responsible_party: {
        name: 'Li Si',
        tel: '13800000002'
      }
    }
  ]
}
```

Multi-line Loop Features:
1. Automatically copies all rows between loop tags
2. Preserves cell formatting (including merged cells, styles)
3. Correctly handles formula references
4. Supports other tag types within the loop (object tags, normal tags, image tags)
5. Automatically adjusts formula references and conditional formatting for subsequent rows

Notes:
>1. Loops support both single-line and multi-line modes
>2. Loops cannot contain nested loop tags
>3. Loops can reference outer object properties
>4. Loops support nested [object tags](#4-object-tag-xxxxxx)
>5. Loops support nested [innerloop tags](#3-innerloop-tag)
>6. Loops support nested [image tags](#5-image-tag-tag)
>7. If a loop tag's target is an object, it acts like a single-line object tag

## 3. Innerloop Tag
Used when you need to fill a single cell with values from each item in an array.
'Inner' means both start and end tags must be within the same cell.

Innerloop tags include:
- Start tag: same as normal loop, `{#someTag}`
- End tag: just `{/}` in curly braces

Example:
|{#items} {name} | {#tags}{value},{/} |  {quantity} | {price} | {/items}                
|:-|:-|:-|:-|:-

Data:
```js
templater.render({
    "items": [
        {
            "name": "AcmeSoft",
            "tags": [{ "value": "fun" }, { "value": "awesome" }],
            "quantity": 10,
            "price": "$100"
        }
    ]
})
```

Result:
|AcmeSoft | fun,awesome | 10 | $100 |
|:-|:-|:-|:-|

>1. Innerloop supports nested [`normal tags`](#1general-tag) and [`image tags`](#5-image-tag)

## 4. Object Tag, `{@xxx}...{/xxx}`
Used to access nested object data in JSON. Includes start and end tags:
- Start tag: begins with @ inside curly braces, e.g., `{@someTag}`
- End tag: begins with / inside curly braces, e.g., `{/someTag}`

Example:
|{@basic}{hostCompany}| | | |
|:-|:-|:-|:-|
|{createTime}|{contactName}|{contactPhone}|{/basic}|

Data:
```js
templater.render({
  basic:{
    hostCompany: 'Huajie',
    contactName: 'Zhangsan',
    contactPhone: '13088888888',
    createTime: '2022-12-09 05:25:00'
  }
})
```

Notes:
>1. Object tag start, end, and inner normal tags can appear in the same cell
>2. Object tags can span multiple rows
>3. Object tags support nesting other object tags
>4. Object tags support [innerloop tags](#innerloop-tag) but not [loop tags](#2-loop-tag)

## 5. Image Tag, `{%tag}`
Used to insert images into cells. Example:
|{%beforePic}|{%afterPic}|

After rendering, these tags will be replaced with the target images. Images will fill the entire cell, so adjust cell size as needed.

In this fork the value behind an image tag may be any of the following (handled by the default loader unless you supply your own `imageLoader`, see below):
- a `Buffer`, `Uint8Array` or `ArrayBuffer` with the raw image bytes
- an object `{ buffer, extension }`
- a `data:image/...;base64,...` URL
- an `http(s)://` URL, fetched with the global `fetch` under a timeout and a byte cap

Image extensions are normalised to `png`, `jpeg` or `gif` (`jpg` becomes `jpeg`; anything else is sniffed from the magic bytes). If the loader returns `null`, the tag is removed from the cell and no image is drawn.

# Render options (DMS fork)

`renderFromFile(filePath, data, worksheetNameList = [], options = {})` and `renderFromBuffer(buffer, data, worksheetNameList = [], options = {})` accept an `options` object:

| Option | Type | Default | Purpose |
|---|---|---|---|
| `imageLoader` | `async (value, tag, ctx, opts) => { buffer, extension } \| null` | built-in loader | Resolves an image tag's raw data value to bytes. Return `null` for "no image here" (the tag is removed, nothing is drawn). Throwing marks the image as failed. Pass your own loader when the host must control outbound traffic; the library then never touches the network. |
| `onImageError` | `(error, ctx) => void` | not set | Called instead of `console.error` when an image fails. Throwing from it aborts the whole render; returning renders the cell without an image. When omitted, the upstream behaviour applies: the error is logged and the tag is left in the cell. |
| `imageTimeoutMs` | number | `15000` | Timeout for the default loader's `fetch`. |
| `imageMaxBytes` | number | `15 * 1024 * 1024` | Maximum response size the default loader accepts. |

`ctx` is `{ tag, value, cellAddress, worksheetName, imageCount, imageIndexInCell }`.

Options are validated before any I/O (`imageLoader` / `onImageError` must be functions when given). They travel to the tag handler through a `WeakMap` keyed by the ExcelJS workbook being rendered, so concurrent renders in one process never see each other's options and the module keeps no mutable static state.

```javascript
const images = new Map([['logo', fs.readFileSync('logo.png')]]);

const out = await XlsxTemplater.renderFromBuffer(template, { title: 'Report', logo: 'logo' }, [], {
  imageLoader: async (value, tag, ctx) => {
    const buffer = images.get(value);
    return buffer ? { buffer, extension: 'png' } : null;
  },
  onImageError: (err, ctx) => {
    throw new Error(`image ${ctx.tag} in ${ctx.worksheetName}!${ctx.cellAddress}: ${err.message}`);
  }
});
```

# Conditional Formatting Support
When using loop tags that add or delete rows, conditional formatting in the worksheet might be affected. Therefore:
- When copying rows, corresponding conditional formatting is copied and row numbers are adjusted
- When deleting rows, corresponding conditional formatting is removed and row numbers are adjusted

>Note: Assumes conditional formatting references and expressions only use cells within the same row, no cross-row references.

# Resolve an error of the Exceljs library: The Worksheet.spiceRows() function will unmerge all subsequent merged cells when deleting rows.
If you are using exceljs version 4.4.0 or earlier, please go to node_modules/exceljs/lib/doc/worksheet.js and then find the spiceRows() function.
In the following branch, it was originally like this.


```js
if (nExpand < 0) {
      // remove rows
      if (start === nEnd) {
        this._rows[nEnd - 1] = undefined;
      }
      for (i = nKeep; i <= nEnd; i++) {
        rSrc = this._rows[i - 1];
        if (rSrc) {
          const rDst = this.getRow(i + nExpand);
          rDst.values = rSrc.values;
          rDst.style = rSrc.style;
          rDst.height = rSrc.height;
          // eslint-disable-next-line no-loop-func
          rSrc.eachCell({includeEmpty: true}, (cell, colNumber) => {
            rDst.getCell(colNumber).style = cell.style;
            // remerge cells accounting for insert offset
            if (cell._value.constructor.name === 'MergeValue') {
              const cellToBeMerged = this.getRow(cell._row._number + nExpand).getCell(colNumber);
              const prevMaster = cell._value._master;
              const newMaster = this.getRow(prevMaster._row._number + nExpand).getCell(prevMaster._column._number);
              cellToBeMerged.merge(newMaster);
            }
          });
          this._rows[i - 1] = undefined;
        } else {
          this._rows[i + nExpand - 1] = undefined;
        }
      }
    }
```
Change it to the following, mainly adding the processing logic for merged cells.
```js
if (nExpand < 0) {
      // remove rows
      if (start === nEnd) {
        this._rows[nEnd - 1] = undefined;
      }
      for (i = nKeep; i <= nEnd; i++) {
        rSrc = this._rows[i - 1];
        if (rSrc) {
          const rDst = this.getRow(i + nExpand);
          rDst.values = rSrc.values;
          rDst.style = rSrc.style;
          rDst.height = rSrc.height;
          // eslint-disable-next-line no-loop-func
          rSrc.eachCell({includeEmpty: true}, (cell, colNumber) => {
            rDst.getCell(colNumber).style = cell.style;
            // new added, fix the unmerged cell bug
            // remerge cells accounting for insert offset
            if (cell._value.constructor.name === 'MergeValue') {
              const cellToBeMerged = this.getRow(cell._row._number + nExpand).getCell(colNumber);
              const prevMaster = cell._value._master;
              const newMaster = this.getRow(prevMaster._row._number + nExpand).getCell(prevMaster._column._number);
              cellToBeMerged.merge(newMaster);
            }
          });
          this._rows[i - 1] = undefined;
        } else {
          this._rows[i + nExpand - 1] = undefined;
        }
      }
    }
```