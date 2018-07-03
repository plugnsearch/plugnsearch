/* eslint-env jest */
import request from 'request'
import Requester from '../../src/requesters/Requester'

jest.mock('request', () => jest.fn())

describe('Requester', () => {
  let requester
  const requestOptions = {
    my: 'options',
    headers: { foo: 'bar' }
  }

  beforeEach(() => {
    requester = new Requester()
  })

  afterEach(() => {
    request.mockClear()
  })

  it('does a request via request lib', () => {
    requester.request(requestOptions)
    expect(request).toHaveBeenCalledWith(requestOptions, expect.any(Function))
  })

  it('resolves the returned promise on successful request', () => {
    expect.assertions(1)
    request.mockImplementation((_options, cb) => cb(null, 'body'))
    return expect(
      requester.request(requestOptions)
    ).resolves.toEqual('body')
  })

  it('rejects the returned promise on errornous request', () => {
    const error = 'BAM'
    expect.assertions(1)
    request.mockImplementation((_options, cb) => cb(error))
    return expect(
      requester.request(requestOptions)
    ).rejects.toEqual(error)
  })
})
