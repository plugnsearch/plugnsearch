import linkscrape from 'linkscrape'
import uniqBy from 'lodash/uniqBy'

export default (html, basePath = null) => {
  return new Promise(function (resolve) {
    linkscrape(basePath, html, (links, $) => {
      const urls = links.map(l => l.link)
      let result = links
        .filter(link => link.link !== null) // no # links and javascript: links and stuff
        .map(link => ({
          url: link.link,
          text: link.text,
          type: link.element.tagName,
          count: urls.filter(url => url === link.link).length
        }))

      resolve(uniqBy(result, l => l.url))
    })
  })
}
