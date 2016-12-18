const express = require('express')
const pug = require('pug')
const path = require('path')

let pageIndex = pug.compileFile(path.join(__dirname, 'view/index.pug'))

module.exports = db => {
  let rMain = express.Router()

  rMain.get('/', function (req, res) {
    res.send(pageIndex({}))
  })
  rMain.use('/resources', express.static(path.join(__dirname, 'dist')))
  rMain.get('/sw.js', function (req, res) {
    res.sendFile(path.join(__dirname, 'dist/sw.js'))
  })

  return rMain
}
