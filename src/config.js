export const MYSQL_CONFIG = {
  host: 'localhost',
  name: 'root',
  password: '',
  database: 'dancecrawler'
}

export const ELASTICSEARCH_CONFIG = {
  host: '127.0.0.1:9200',
  log: 'error'
}

export const POSTGRESQL_CONFIG = {
  database: 'dancecrawler',
  name: 'root',
  password: '',
  config: {
    host: 'localhost',
    dialect: 'postgres'
    // pool: {
    //   max: 5,
    //   min: 0,
    //   acquire: 30000,
    //   idle: 10000
    // }
  }
}
