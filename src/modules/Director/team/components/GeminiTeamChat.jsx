import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Send,
  User,
  Bot,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Award,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  Key,
  Check,
  X,
  Settings,
  Loader2
} from 'lucide-react'
import { askCentrumAi, getSavedAiApiKey, saveAiApiKey, validateAiKey } from '../utils/centrumAiService'

const DEFAULT_PROMPT_CHIPS = [
  { icon: Layers, label: 'Залишки фрез 3мм на СО', query: 'Які залишки фрез 3мм на СО?' },
  { icon: Clock, label: 'За які дати береш дані?', query: 'За які дати ти береш дані?' },
  { icon: Award, label: 'Хто найкращий оператор?', query: 'Хто найкращий оператор за рейтингом?' },
  { icon: AlertTriangle, label: 'У кого найбільший брак?', query: 'У кого з операторів найбільший відсоток браку?' },
  { icon: Layers, label: 'Порівняй усі 4 зміни', query: 'Порівняй ефективність усіх 4 змін виробництва' },
  { icon: User, label: 'Аудит: Когут Назар', query: 'Зроби детальний аудит та досьє на Когут Назар' }
]

export const GeminiTeamChat = ({
  operators = [],
  shifts = [],
  history = [],
  nomenclatures = [],
  inventory = [],
  orders = [],
  tasks = [],
  machines = [],
  workCards = [],
  dateRange = '30d',
  onOpenDossier
}) => {
  const [apiKey, setApiKey] = useState(() => getSavedAiApiKey())
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false)
  const [tempKeyInput, setTempKeyInput] = useState('')
  const [isVerifyingKey, setIsVerifyingKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [keySuccess, setKeySuccess] = useState('')

  const shiftsCount = shifts.length > 0 ? shifts.length : 4
  const opsCount = operators.length > 0 ? operators.length : 37

  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome-msg',
      sender: 'bot',
      text: `### 🌟 Вітаю у системі CENTRUM AI!

Я ваш персональний цифровий співрозмовник на базі оперативних даних MES Centrum. Спілкуйтеся зі мною звичайною мовою — я розумію стан виробництва, залишки на складах (СО/СГП), наряди **${opsCount} операторів** та продуктивність **${shiftsCount} змін**.

Запитайте мене будь-що напряму або оберіть швидке питання нижче:`,
      suggestions: [
        'Які залишки фрез 3мм на СО?',
        'За які дати ти береш дані?',
        'Хто найкращий оператор?',
        'Порівняй усі 4 зміни'
      ]
    }
  ])

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome-msg') {
        const sCount = shifts.length > 0 ? shifts.length : 4
        const opCount = operators.length > 0 ? operators.length : 37
        return [{
          ...prev[0],
          text: `### 🌟 Вітаю у системі CENTRUM AI!

Я ваш персональний інтелектуальний асистент на базі оперативних даних MES Centrum. Я безперервно аналізую роботу **${opCount} операторів**, продуктивність **${sCount} змін**, відсотки браку та ресурс ріжучого інструменту.

Запитайте мене будь-що звичайною мовою або оберіть швидке питання нижче:`
        }]
      }
      return prev
    })
  }, [operators.length, shifts.length])

  const [inputVal, setInputVal] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const chatBottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputVal).trim()
    if (!query) return

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    setInputVal('')
    setIsThinking(true)

    try {
      const response = await askCentrumAi(query, {
        operators,
        shifts,
        history,
        nomenclatures,
        inventory,
        orders,
        tasks,
        machines,
        workCards,
        dateRange,
        chatHistory: messages
      })

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'bot',
        ...response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, aiMsg])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'bot',
          text: `Виникла помилка під час обробки запиту: ${e.message}. Спробуйте ще раз.`,
          badge: '⚠️ Помилка'
        }
      ])
    } finally {
      setIsThinking(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: 'Чат очищено. Готовий до нових аналітичних запитів по операторах, нарядах та якості.',
        suggestions: [
          'Які залишки фрез 3мм на СО?',
          'За які дати ти береш дані?',
          'Хто найкращий оператор?',
          'Порівняй усі 4 зміни'
        ]
      }
    ])
  }

  const handleSaveApiKey = async () => {
    const clean = tempKeyInput.trim()
    if (!clean) {
      saveAiApiKey('')
      setApiKey('')
      setKeyError('')
      setKeySuccess('')
      setIsApiKeyModalOpen(false)
      return
    }

    setIsVerifyingKey(true)
    setKeyError('')
    setKeySuccess('')

    const res = await validateAiKey(clean)
    setIsVerifyingKey(false)

    if (res.ok) {
      saveAiApiKey(clean)
      setApiKey(clean)
      setKeySuccess(`✅ Успішно підключено (${res.provider})!`)
      setTimeout(() => {
        setIsApiKeyModalOpen(false)
        setKeySuccess('')
      }, 1200)
    } else {
      setKeyError(`Помилка підключення: ${res.error || 'Ключ недійсний'}. Перевірте правильність введеного ключа.`)
    }
  }

  return (
    <div className="gemini-chat-container">
      {/* Top Banner / Header */}
      <div className="gemini-header-glass">
        <div className="gemini-brand-left">
          <div className="gemini-sparkle-halo">
            <Sparkles size={20} className="gemini-icon-gradient" />
          </div>
          <div>
            <div className="gemini-title-row">
              <span className="gemini-main-title">CENTRUM AI</span>
              <span className="gemini-badge-ai">DIRECTOR COPILOT</span>
              {apiKey ? (
                <span className="gemini-status-pill online" title="Підключено прямий Gemini 1.5 Flash">
                  ⚡ Gemini Live
                </span>
              ) : (
                <span className="gemini-status-pill offline" title="Працює на базі локального MES-аналізатора">
                  🟠 Native MES AI
                </span>
              )}
            </div>
            <span className="gemini-subtitle">Інтелектуальний аналіз Big Data виробництва • Centrum Live Intelligence</span>
          </div>
        </div>

        <div className="gemini-actions-right">
          <button
            className={`gemini-key-btn ${apiKey ? 'has-key' : ''}`}
            onClick={() => {
              setTempKeyInput(apiKey)
              setIsApiKeyModalOpen(true)
            }}
            title="Налаштування API Ключа Gemini / ШІ"
          >
            <Key size={14} />
            <span>{apiKey ? 'API підключено' : 'Підключити API'}</span>
          </button>

          <button className="gemini-clear-btn" onClick={handleClearHistory} title="Очистити історію">
            <RotateCcw size={14} />
            <span>Очистити</span>
          </button>
        </div>
      </div>

      {/* Suggestion Chips Banner */}
      <div className="gemini-chips-shelf">
        {DEFAULT_PROMPT_CHIPS.map((chip, idx) => {
          const Icon = chip.icon
          return (
            <button
              key={idx}
              className="gemini-prompt-chip"
              onClick={() => handleSend(chip.query)}
            >
              <Icon size={14} className="chip-icon" />
              <span>{chip.label}</span>
            </button>
          )
        })}
      </div>

      {/* Messages Scroll Area */}
      <div className="gemini-messages-body">
        {messages.map((m) => {
          const isUser = m.sender === 'user'

          return (
            <div key={m.id} className={`gemini-msg-row ${isUser ? 'user-row' : 'bot-row'}`}>
              {!isUser && (
                <div className="gemini-avatar">
                  <Sparkles size={16} />
                </div>
              )}

              <div className={`gemini-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
                {/* Badge if available */}
                {m.badge && (
                  <div className="gemini-msg-badge">
                    <span>{m.badge}</span>
                  </div>
                )}

                {/* Formatted Content */}
                <div className="gemini-text-content">
                  <FormattedMarkdown content={m.text} />
                </div>

                {/* Interactive Table if provided */}
                {m.tableData && m.tableData.length > 0 && (
                  <div className="gemini-inline-table-box">
                    <table className="gemini-mini-table">
                      <thead>
                        <tr>
                          <th>Оператор</th>
                          <th>Швидкість</th>
                          <th>Брак</th>
                          <th>Випущено</th>
                          <th>Рейтинг</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.tableData.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="font-semibold op-table-name">{row.name}</td>
                            <td className="text-amber-500 font-bold">{row.speed}</td>
                            <td className={parseFloat(row.scrap) > 2 ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>{row.scrap}</td>
                            <td>{row.produced}</td>
                            <td className="text-orange font-bold">{row.score}/100</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Direct Action Button */}
                {m.action && (
                  <div className="gemini-action-box">
                    <button
                      className="gemini-action-btn"
                      onClick={() => {
                        if (m.action.type === 'OPEN_DOSSIER' && onOpenDossier) {
                          const op = operators.find(o => o.name.toLowerCase().includes(m.action.operatorName.toLowerCase()))
                          if (op) onOpenDossier(op)
                        }
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>{m.action.label}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Inline follow-up suggestions */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="gemini-followup-pills">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        className="gemini-sug-pill"
                        onClick={() => handleSend(sug)}
                      >
                        <ChevronRight size={12} />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="gemini-user-avatar">
                  <User size={16} />
                </div>
              )}
            </div>
          )
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="gemini-msg-row bot-row anim-fade-in">
            <div className="gemini-avatar thinking-halo">
              <Sparkles size={16} className="anim-spin-slow" />
            </div>
            <div className="gemini-bubble bot-bubble thinking-bubble">
              <div className="gemini-typing-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              <span className="thinking-text">CENTRUM AI аналізує базу даних, наряди та операторів...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Floating Bottom Input Bar */}
      <div className="gemini-input-dock">
        <div className="gemini-input-card">
          <div className="gemini-input-sparkle">
            <Sparkles size={18} className="text-amber-500" />
          </div>

          <textarea
            ref={inputRef}
            rows={1}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Запитайте що завгодно про команду, операторів, брак чи ефективність..."
            className="gemini-textarea"
          />

          <button
            className={`gemini-send-btn ${inputVal.trim() ? 'active' : ''}`}
            onClick={() => handleSend()}
            disabled={!inputVal.trim() || isThinking}
            title="Надіслати запит"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="gemini-input-footnote">
          CENTRUM AI використовує оперативну базу даних цехів підприємства для формування управлінських звітів.
        </div>
      </div>

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="gemini-modal-overlay">
          <div className="gemini-key-modal">
            <div className="gemini-key-modal-header">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-orange" />
                <h3>Підключення Google Gemini API</h3>
              </div>
              <button className="gemini-close-btn" onClick={() => setIsApiKeyModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="gemini-key-modal-body">
              <p>
                Введіть ваш <strong>Google Gemini API Key</strong> (безкоштовно на aistudio.google.com) або <strong>OpenAI API Key</strong> (sk-...).
                При підключенні штучний інтелект спілкується живою людською мовою та має повний контекст бази виробництва.
              </p>

              <div className="gemini-key-input-box">
                <input
                  type="password"
                  placeholder="AIzaSy... або sk-..."
                  value={tempKeyInput}
                  onChange={(e) => {
                    setTempKeyInput(e.target.value)
                    setKeyError('')
                    setKeySuccess('')
                  }}
                  className="gemini-key-input"
                />
              </div>

              {keyError && (
                <div className="text-red-500 text-xs font-semibold p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                  {keyError}
                </div>
              )}

              {keySuccess && (
                <div className="text-emerald-500 text-xs font-semibold p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  {keySuccess}
                </div>
              )}

              <div className="gemini-key-tip">
                Якщо залишити поле порожнім — CENTRUM AI використовуватиме вбудований алгоритм MES без виклику хмарного ШІ.
              </div>
            </div>

            <div className="gemini-key-modal-footer">
              <button
                className="gemini-cancel-btn"
                onClick={() => {
                  setIsApiKeyModalOpen(false)
                  setKeyError('')
                  setKeySuccess('')
                }}
                disabled={isVerifyingKey}
              >
                Скасувати
              </button>
              <button
                className="gemini-save-key-btn"
                onClick={handleSaveApiKey}
                disabled={isVerifyingKey}
              >
                {isVerifyingKey ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Перевірка...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} /> <span>Зберегти та підключити</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Lightweight formatting helper for markdown-like text in chat
 */
function FormattedMarkdown({ content = '' }) {
  const lines = content.split('\n')

  return (
    <div className="gemini-md-render">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="md-spacer" />
        }

        if (line.startsWith('### ')) {
          return <h4 key={idx} className="md-h4">{renderBold(line.replace('### ', ''))}</h4>
        }

        if (line.startsWith('#### ')) {
          return <h5 key={idx} className="md-h5">{renderBold(line.replace('#### ', ''))}</h5>
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="md-bullet">
              <span className="md-bullet-dot">•</span>
              <span>{renderBold(line.substring(2))}</span>
            </div>
          )
        }

        const numMatch = line.match(/^(\d+)\.\s+(.*)$/)
        if (numMatch) {
          return (
            <div key={idx} className="md-numbered">
              <span className="md-num">{numMatch[1]}.</span>
              <span>{renderBold(numMatch[2])}</span>
            </div>
          )
        }

        return <p key={idx} className="md-p">{renderBold(line)}</p>
      })}
    </div>
  )
}

function renderBold(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="gemini-bold">{part.slice(2, -2)}</strong>
    }
    return part
  })
}
