/* eslint-env jest */
import SpiderApp from '../src/SpiderApp'

describe('SpiderApp with plain returns', () => {
  class SimpleTestApp extends SpiderApp {
    parseDocument (params) {
      return { params }
    }

    expandLinks (params) {
      return ['http://anewlink.com', 'https://a-new.world']
    }
  }

  describe('calling process', () => {
    it('calls parseDocument and queueLinks with the returned value', done => {
      const app = new SimpleTestApp()
      const params = {
        body: 'BODY',
        $: '$',
        headers: 'HEADERS',
        url: 'http://here.we.go',
        statusCode: 200
      }
      const appInterface = {
        queueLinks: jest.fn(),
        postResults: jest.fn()
      }

      app.process(params, appInterface)
        .then(() => {
          expect(appInterface.postResults).toHaveBeenCalledWith('http://here.we.go', { params })
          expect(appInterface.queueLinks).toHaveBeenCalledWith(['http://anewlink.com', 'https://a-new.world'])
          done()
        })
        .catch(err => {
          console.error(err)
          done()
        })
    })
  })
})

describe('SpiderApp with promise returned', () => {
  class PromiseTestApp extends SpiderApp {
    parseDocument (params) {
      return new Promise(function (resolve) {
        resolve({ params })
      })
    }

    expandLinks (params) {
      return new Promise(function (resolve) {
        resolve(['http://anewlink.com', 'https://a-new.world'])
      })
    }
  }

  describe('calling process', () => {
    it('calls parseDocument and queueLinks with the resolved value', done => {
      const app = new PromiseTestApp()
      const params = {
        body: 'BODY',
        $: '$',
        headers: 'HEADERS',
        url: 'http://here.we.go'
      }
      const appInterface = {
        queueLinks: jest.fn(),
        postResults: jest.fn()
      }

      app.process(params, appInterface)
        .then(() => {
          expect(appInterface.postResults).toHaveBeenCalledWith('http://here.we.go', { params })
          expect(appInterface.queueLinks).toHaveBeenCalledWith(['http://anewlink.com', 'https://a-new.world'])
          done()
        })
        .catch(err => {
          console.error(err)
          done()
        })
    })
  })
})

describe('SpiderApp with promise throwing ip', () => {
  class BadPromiseTestApp extends SpiderApp {
    parseDocument (params) {
      return new Promise(function (resolve, reject) {
        reject(new Error('BUMM'))
      })
    }

    expandLinks (params) {
      return new Promise(function (resolve, reject) {
        reject(new Error('BAM'))
      })
    }
  }

  describe('calling process', () => {
    it('passes through the exception', done => {
      const app = new BadPromiseTestApp()
      const params = {
        body: 'BODY',
        $: '$',
        headers: 'HEADERS',
        url: 'http://here.we.go'
      }
      const appInterface = {
        queueLinks: jest.fn(),
        postResults: jest.fn()
      }

      app.process(params, appInterface)
        .then(() => {
          expect(true).toEqual(false)
          done()
        })
        .catch(err => {
          expect(err).toEqual(new Error('BUMM'))
          done()
        })
    })
  })
})
