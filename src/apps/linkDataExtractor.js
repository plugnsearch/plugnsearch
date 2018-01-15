import dataExtractor from '../utils/dataExtractor'
import linkExtractor from '../utils/linkExtractor'

export const parseDocument = (body, $, headers, url) => {
  return dataExtractor(body).then(meta => {
    return { meta }
  })
}

export const expandLinks = (body, $, headers, url) => {
  return linkExtractor(body, url)
}
