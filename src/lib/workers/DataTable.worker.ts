import { dev } from "$app/environment"
import type { MessageRequestSaveToFile, MessageRequestFetchData, MessageRequestLoadFile, MessageResponseFetchData, PostMessage, MessageRequestUpdateRows, MessageRequestInsertRows, MessageRequestDeleteRows } from "./messages"
import { desc, escape, loadJSON, loadCSV, op, from } from 'arquero'
import type ColumnTable from 'arquero/dist/types/table/column-table'

let dt: ColumnTable
let tempDt: ColumnTable | undefined

onmessage = async ({ data: { msg, data } }: MessageEvent<PostMessage<unknown>>) => {
  switch (msg) {
    case 'loadFile':
      await loadFile(data as MessageRequestLoadFile)
      break
    case 'getColumnNames':
      getColumnNames()
      break
    case "fetchData":
      await fetchData(data as MessageRequestFetchData)
      break
    case "saveToFile":
      await saveToFile(data as MessageRequestSaveToFile)
      break
    case "updateRows":
      await updateRows(data as MessageRequestUpdateRows)
      break
    case "insertRows":
      await insertRows(data as MessageRequestInsertRows)
      break
    case "deleteRows":
      await deleteRows(data as MessageRequestDeleteRows)
      break
  }
}

async function loadFile(data: MessageRequestLoadFile) {
  tempDt = undefined
  switch (data.extension) {
    case 'csv':
      dt = await loadCSV(data.url, {})
      break
    case 'json':
      dt = await loadJSON(data.url, {})
      break
    default:
      throw new Error(`Unknown extension '${data.extension}'`)
  }

  const message: PostMessage<unknown> = {
    msg: 'loadFile',
    data: undefined
  }
  postMessage(message)
}

function getColumnNames() {
  const columnNames = dt.columnNames()
  const message: PostMessage<string[]> = {
    msg: 'getColumnNames',
    data: columnNames
  }
  postMessage(message)
}

async function fetchData(data: MessageRequestFetchData) {
  if (!data.onlyPaginationChanged || !tempDt) {
    tempDt = dt
    //filter
    for (const [column, filter] of [...data.filteredColumns].values()) {
      const lowerCaseFilter = filter?.toString().toLowerCase()
      tempDt = tempDt.filter(escape((d: any) => {
        return op.lower(d[column]).includes(lowerCaseFilter)
      }))
    }
    //sort
    for (let [column, sortDirection] of [...data.sortedColumns].reverse()) {
      //Sort is applied in reverse order !!!
      switch (sortDirection) {
        case 'asc':
          tempDt = tempDt.orderby(column)
          break
        case 'desc':
          tempDt = tempDt.orderby(desc(column))
          break
      }
    }
  }
  //pagination
  const totalRows = tempDt.numRows()
  const objects = tempDt.objects({ limit: data.pagination.rowsPerPage, offset: (data.pagination.currentPage - 1) * data.pagination.rowsPerPage })
  const indices = tempDt.indices().slice((data.pagination.currentPage - 1) * data.pagination.rowsPerPage, data.pagination.currentPage * data.pagination.rowsPerPage)
  const matrix = objects.map(obj => Object.values(obj))

  const message: PostMessage<MessageResponseFetchData> = {
    msg: 'fetchData',
    data: { totalRows, data: matrix, indices: indices }
  }
  postMessage(message)
}

async function saveToFile({ fileHandle, options }: MessageRequestSaveToFile) {
  const extension = fileHandle.name.split('.').pop()
  switch (extension) {
    case "csv":
      await exportCSV({ fileHandle, options })
      break;
    default:
      throw new Error(`Unknown or not yet implemented export file extension: '${extension}'`);
  }
}

async function exportCSV({ fileHandle, options }: MessageRequestSaveToFile) {
  const writable = await fileHandle.createWritable()

  const names: string[] = options?.columns || dt.columnNames()
  //const format = options?.format || {};
  const delim = options?.delimiter || ',';
  const reFormat = new RegExp(`["${delim}\n\r]`);
  const bufferRowSize = options?.bufferRowSize || 5000

  const formatValue = (value: any) => value == null ? ''
    : value instanceof Date ? (value as Date).toISOString()
      : reFormat.test(value += '') ? '"' + value.replace(/"/g, '""') + '"'
        : value

  let buffer = []

  //write the header
  const cells = names.map(formatValue);
  buffer.push(cells.join(delim) + '\n')

  //write the rows
  for (let rowIndex = 0; rowIndex < dt.totalRows(); rowIndex++) {
    if (rowIndex % bufferRowSize == 0) {
      await writable.write(buffer.join(''))
      if (dev)
        console.log(`DataTable: saved ${rowIndex} rows to file`)
      buffer = []
    }
    const cells = names.map(col => formatValue(dt.get(col, rowIndex)))
    buffer.push(cells.join(delim) + '\n')
  }
  await writable.write(buffer.join(''))
  await writable.close()

  const message: PostMessage<URL> = {
    msg: 'saveToFile',
    data: undefined
  }
  postMessage(message)
}

function updateRows({ rowsByIndex }: MessageRequestUpdateRows) {
  //tempDt = undefined
  for (let [index, row] of rowsByIndex) {
    for (const [column, value] of Object.entries(row)) {
      dt._data[column].data[index] = value
    }
  }

  const message: PostMessage<unknown> = {
    msg: 'updateRows',
    data: undefined
  }
  postMessage(message)
}

function insertRows({ rows }: MessageRequestInsertRows) {
  tempDt = undefined

  dt = dt.concat(from(rows))

  const message: PostMessage<unknown> = {
    msg: 'insertRows',
    data: undefined
  }
  postMessage(message)
}

function deleteRows({ indices }: MessageRequestDeleteRows) {
  tempDt = undefined

  const rowObjects = indices.reduce((acc, cur) => {
    acc.push(dt.object(cur!))
    return acc
  }, [] as Record<string, any>[])


  dt = dt.antijoin(from(rowObjects))

  const message: PostMessage<unknown> = {
    msg: 'deleteRows',
    data: undefined
  }
  postMessage(message)
}

export default {}