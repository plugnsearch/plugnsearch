import isArray from 'lodash/isArray'

const checkContentType = (validContentType, contentType) => {
  if (!validContentType) return true

  if (typeof validContentType === 'string') return validContentType === contentType

  if (isArray(validContentType)) return validContentType.indexOf(contentType) !== -1

  if (validContentType.constructor === RegExp) return validContentType.test(contentType)

  return false
}

export default checkContentType
