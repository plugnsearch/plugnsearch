const after = (result) => {
  if (result && result.constructor === Promise) {
    return result
  } else {
    return new Promise(function (resolve) {
      resolve(result)
    })
  }
}

export default class SpiderApp {
  process (params, { queueLinks, postResults }) {
    return after(this.parseDocument(params))
      .then(data => {
        postResults(params.url, data)
        // Then expanding links
        return after(this.expandLinks(params))
        .then(links => {
          if (links) {
            queueLinks(links)
          }
        })
      })
  }

  parseDocument (body, $, headers, url) {
    // Implement me in subclass
    return null
  }

  expandLinks (body, $, headers, url) {
    // Implement me in subclass
    return null
  }
}
