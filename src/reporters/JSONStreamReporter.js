import fs from 'fs'

const JSON_REGEX = /\.json$/

export default class JSONStreamReporter {
  constructor ({ filename, fileLimitSize = null }) {
    this.filename = JSON_REGEX.test(filename) ? filename : `${filename}.json`
    this.fileLimitSize = fileLimitSize
    this.chunkNumber = 1
    this.files = []
    this.openNewFile()
  }

  openNewFile () {
    const filename = this.chunkNumber === 1 ? this.filename : this.filename.replace(JSON_REGEX, `-${this.chunkNumber}.json`)
    this.stream = fs.createWriteStream(filename)
    this.stream.write('[')
    this.files.push(filename)
    this.alreadyWritten = false
    this.writtenData = 1
    ++this.chunkNumber
  }

  report (url, type, content) {
    if (this.alreadyWritten) {
      // make it valid json
      this.stream.write(', ')
      this.writtenData += 2
    }
    const dataToWrite = JSON.stringify({
      url: url.toString(),
      [type]: content
    }, null, 2)
    this.writtenData += dataToWrite.length
    this.stream.write(dataToWrite)
    this.alreadyWritten = true
    if (this.fileLimitSize && this.writtenData >= this.fileLimitSize) {
      this.lastStream = this.stream.end(']')
      this.openNewFile()
    }
  }

  closeStream () {
    return new Promise(resolve => {
      this.stream
        .on('finish', () => {
          if (this.lastStream) {
            this.lastStream.on('finish', resolve)
          } else {
            resolve()
          }
        })
        .end(']')
    })
  }
}
