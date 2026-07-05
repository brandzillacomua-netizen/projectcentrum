import { useState } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

export function useSettingsImports() {
  const { nomenclatures, inventory, refreshTable } = useMES()

  // BZ remnants upload states
  const [bzFile, setBzFile] = useState(null)
  const [bzDelimiter, setBzDelimiter] = useState(';')
  const [bzRecordMode, setBzRecordMode] = useState('add')
  const [bzUploadStatus, setBzUploadStatus] = useState('idle')
  const [bzUploadLog, setBzUploadLog] = useState('')
  const [bzActivePreviewTab, setBzActivePreviewTab] = useState('leftovers')
  const [bzAssembledKits, setBzAssembledKits] = useState([])
  const [bzLeftovers, setBzLeftovers] = useState([])
  const [bzUnrecognized, setBzUnrecognized] = useState([])

  // Prepared sheets upload states
  const [sheetsFile, setSheetsFile] = useState(null)
  const [sheetsDelimiter, setSheetsDelimiter] = useState(';')
  const [sheetsRecordMode, setSheetsRecordMode] = useState('add')
  const [sheetsUploadStatus, setSheetsUploadStatus] = useState('idle')
  const [sheetsUploadLog, setSheetsUploadLog] = useState('')
  const [sheetsPreviewList, setSheetsPreviewList] = useState([])

  // Cutter (фрези) stock upload states
  const [cuttersFile, setCuttersFile] = useState(null)
  const [cuttersRecordMode, setCuttersRecordMode] = useState('overwrite')
  const [cuttersUploadStatus, setCuttersUploadStatus] = useState('idle')
  const [cuttersUploadLog, setCuttersUploadLog] = useState('')
  const [cuttersPreviewList, setCuttersPreviewList] = useState([])

  // Fasteners (метизи) stock upload states
  const [fastenersFile, setFastenersFile] = useState(null)
  const [fastenersRecordMode, setFastenersRecordMode] = useState('overwrite')
  const [fastenersUploadStatus, setFastenersUploadStatus] = useState('idle')
  const [fastenersUploadLog, setFastenersUploadLog] = useState('')
  const [fastenersPreviewList, setFastenersPreviewList] = useState([])

  const normalizeHomoglyphs = (str) => {
    if (!str) return ''
    const mapper = {
      'а': 'a', 'в': 'v', 'с': 'c', 'е': 'e', 'н': 'h', 'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x', 'у': 'y', 'і': 'i', 'ї': 'i', 'є': 'e',
      'А': 'a', 'В': 'v', 'С': 'c', 'Е': 'e', 'Н': 'h', 'К': 'k', 'М': 'm', 'О': 'o', 'Р': 'p', 'Т': 't', 'Х': 'x', 'У': 'y', 'І': 'i', 'Ї': 'i', 'Є': 'e'
    }
    return str.toLowerCase().trim().split('').map(c => mapper[c] || c).join('').replace(/[^a-z0-9]/g, '')
  }

  const parseCSV = (text, delimiter = ';') => {
    const lines = []
    let row = [""]
    let inQuotes = false
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        row.push("")
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++
        }
        lines.push(row.map(cell => cell.trim()))
        row = [""]
      } else {
        row[row.length - 1] += char
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row.map(cell => cell.trim()))
    }
    return lines.filter(line => line.length > 0 && line.some(cell => cell !== ""))
  }

  const detectDelimiter = (text) => {
    const firstLine = text.split(/\r?\n/)[0] || text
    const commaCount = (firstLine.match(/,/g) || []).length
    const semicolonCount = (firstLine.match(/;/g) || []).length
    return semicolonCount >= commaCount ? ';' : ','
  }

  return {
    bzFile, setBzFile, bzDelimiter, setBzDelimiter, bzRecordMode, setBzRecordMode,
    bzUploadStatus, setBzUploadStatus, bzUploadLog, setBzUploadLog, bzActivePreviewTab, setBzActivePreviewTab,
    bzAssembledKits, setBzAssembledKits, bzLeftovers, setBzLeftovers, bzUnrecognized, setBzUnrecognized,
    sheetsFile, setSheetsFile, sheetsDelimiter, setSheetsDelimiter, sheetsRecordMode, setSheetsRecordMode,
    sheetsUploadStatus, setSheetsUploadStatus, sheetsUploadLog, setSheetsUploadLog, sheetsPreviewList, setSheetsPreviewList,
    cuttersFile, setCuttersFile, cuttersRecordMode, setCuttersRecordMode, cuttersUploadStatus, setCuttersUploadStatus,
    cuttersUploadLog, setCuttersUploadLog, cuttersPreviewList, setCuttersPreviewList,
    fastenersFile, setFastenersFile, fastenersRecordMode, setFastenersRecordMode, fastenersUploadStatus, setFastenersUploadStatus,
    fastenersUploadLog, setFastenersUploadLog, fastenersPreviewList, setFastenersPreviewList,
    normalizeHomoglyphs, parseCSV, detectDelimiter
  }
}
