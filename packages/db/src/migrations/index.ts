import * as init from './0001_init'

export interface Migration {
  id: string
  sql: string
}

export const migrations: Migration[] = [{ id: init.id, sql: init.sql }]
