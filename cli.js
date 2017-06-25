#!/usr/bin/env node
'use strict'

const yargs = require('yargs')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs')

const getSize = require('.')

const argv = yargs
  .usage('$0 [FILES]')
  .example('$0 ./index.js ./extra.js')
  .epilog('If you miss files, size-limit will take main file ' +
          'from package.json')
  .locale('en')
  .version()
  .help()
  .argv

function isRoot (dir) {
  if (process.platform === 'win32') {
    return /^\w:[\\/]*$/.test(dir)
  } else {
    return dir === '/'
  }
}

function showError (msg) {
  process.stderr.write(chalk.red(`${ msg }\n`))
}

function findPackage (dir) {
  if (isRoot(dir)) return Promise.resolve(false)
  const file = path.join(dir, 'package.json')

  return new Promise(resolve => {
    fs.readFile(file, (err, data) => {
      if (err) {
        resolve(findPackage(path.dirname(dir)))
      } else {
        resolve({ package: JSON.parse(data), dir })
      }
    })
  })
}

let getFiles
if (argv['_'].length > 0) {
  getFiles = Promise.resolve(argv['_'].map(i => {
    if (path.isAbsolute(i)) {
      return i
    } else {
      return path.join(process.cwd(), i)
    }
  }))
} else {
  getFiles = findPackage(process.cwd()).then(result => {
    if (result) {
      return [path.join(result.dir, result.package.main || 'index.js')]
    } else {
      return []
    }
  })
}

getFiles.then(files => {
  if (files.length === 0) {
    const error = new Error(
      'Specify project files or run in project dir with package.json')
    error.sizeLimit = true
    throw error
  }
  return getSize.apply({ }, files)
}).then(size => {
  process.stdout.write(`${ size }\n`)
}).catch(e => {
  if (e.sizeLimit) {
    showError(e.message)
  } else if (e.message.indexOf('Module not found:') !== -1) {
    const first = e.message.match(/Module not found:[^\n]*/)[0]
    const filtered = first.replace('Module not found: Error: ', '')
    showError(filtered)
  } else {
    showError(e.stack)
  }
  process.exit(1)
})
