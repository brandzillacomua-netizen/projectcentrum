import React from 'react'
import { Barcode, QrCode, Printer, Copy, Check, Sparkles, CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export const IdentificationTab = ({
  item,
  labelSize, setLabelSize,
  labelMode, setLabelMode,
  barcodeSvgRef, labelBarcodeSvgRef, labelQrContainerRef,
  currentQr,
  copyToClipboard, copiedKey,
  handlePrintThermalLabel
}) => {
  return (
    <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Left Column: Visual Barcode & QR Display */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Barcode size={20} color="#ff9000" />
                    (B@8E:>4 (Code 128)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                    !B0=40@B=89 ?@><8A;>289 HB@8E:>4 4;O A:0=5@V2 A:;04C B0 F5EC
                  </p>
                </div>

                {/* Main Barcode Display Card */}
                <div style={{
                  background: '#ffffff',
                  border: '2px dashed var(--border-color, #cbd5e1)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '110px'
                }}>
                  <svg ref={barcodeSvgRef} style={{ maxWidth: '100%' }} />
                </div>

                {/* QR Code and Quick Details Box */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  background: 'var(--bg, #f1f5f9)',
                  borderRadius: '14px',
                  padding: '16px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    background: '#ffffff',
                    padding: '8px',
                    borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    flexShrink: 0
                  }}>
                    <QRCodeSVG 
                      value={currentQr || item.code} 
                      size={100} 
                      level="M" 
                      includeMargin={false} 
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                      <VAB QR-:>4C (Payload):
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: 'var(--text, #0f172a)',
                      wordBreak: 'break-all',
                      background: 'var(--card-bg, #ffffff)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                      {currentQr || item.code}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => copyToClipboard(currentQr || item.code, 'qr')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'rgba(255, 144, 0, 0.1)',
                          border: '1px solid rgba(255, 144, 0, 0.3)',
                          color: '#d97706',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {copiedKey === 'qr' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'qr' ? '!:>?V9>20=>' : '>?VN20B8'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Enterprise Standardization Guarantee Banner */}
                <div style={{
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  paddingTop: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  background: 'rgba(5, 150, 105, 0.06)',
                  border: '1px solid rgba(5, 150, 105, 0.2)',
                  borderRadius: '14px',
                  padding: '14px 16px'
                }}>
                  <CheckCircle2 size={22} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#065f46', marginBottom: '3px' }}>
                      48=89 ERP-AB0=40@B <0@:C20==O CENTRUM
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#047857', lineHeight: 1.45 }}>
                      (B@8E:>4 (Code 128) B0 QR-:>4 735=5@>20=> 02B><0B8G=> =0 >A=>2V C=VDV:>20=>3> :>4C ?>78FVW <b>{item.code}</b>.  CG=0 <>48DV:0FVO 701;>:>20=0 4;O 70157?5G5==O 100% B>G=>ABV A:0=C20==O =0 2AVE 4V;O=:0E 28@>1=8FB20 B0 A:;04C.
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Thermal Label Printer & Preview */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={20} color="#ff9000" />
                        "5@<>-4@C: ABV:5@0 (5B8:5B:8)
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                        V43>B>2:0 =0 B5@<>?@8=B5@8 (Xprinter, Zebra, TSC)
                      </p>
                    </div>

                    {/* Size Selector */}
                    <div style={{ display: 'flex', background: 'var(--bg, #f1f5f9)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                      <button
                        onClick={() => setLabelSize('58x40')}
                        style={{
                          background: labelSize === '58x40' ? '#ffffff' : 'transparent',
                          color: labelSize === '58x40' ? '#ff9000' : 'var(--text-muted, #64748b)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        58x40 <<
                      </button>
                      <button
                        onClick={() => setLabelSize('50x30')}
                        style={{
                          background: labelSize === '50x30' ? '#ffffff' : 'transparent',
                          color: labelSize === '50x30' ? '#ff9000' : 'var(--text-muted, #64748b)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        50x30 <<
                      </button>
                    </div>
                  </div>

                  {/* Mode / Layout Selector: Barcode vs QR vs Combo */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--bg, #f1f5f9)',
                    padding: '4px',
                    borderRadius: '10px',
                    gap: '4px'
                  }}>
                    {[
                      { id: 'barcode', label: '(B@8E:>4', icon: Barcode },
                      { id: 'qr', label: 'QR-:>4', icon: QrCode },
                      { id: 'combo', label: '(B@8E + QR (><1>)', icon: Sparkles }
                    ].map(m => {
                      const Icon = m.icon
                      const isSel = labelMode === m.id
                      return (
                        <button
                          key={m.id}
                          onClick={() => setLabelMode(m.id)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: isSel ? '#ffffff' : 'transparent',
                            color: isSel ? '#ff9000' : 'var(--text-muted, #64748b)',
                            border: isSel ? '1px solid var(--border-color, #cbd5e1)' : '1px solid transparent',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            fontSize: '0.75rem',
                            fontWeight: isSel ? 900 : 700,
                            cursor: 'pointer',
                            boxShadow: isSel ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Icon size={14} />
                          <span>{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Thermal Sticker Visual Preview */}
                <div style={{
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                  padding: '28px',
                  borderRadius: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div 
                    id="thermal-label-preview"
                    style={{
                      width: labelSize === '50x30' ? '240px' : '280px',
                      height: labelSize === '50x30' ? '145px' : '185px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      color: '#000000',
                      position: 'relative'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000000', paddingBottom: '3px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.5px' }}>CENTRUM ERP</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, fontFamily: 'monospace' }}>{item.code}</span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: labelSize === '50x30' ? '0.72rem' : '0.82rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                      maxHeight: '34px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {item.name}
                    </div>

                    {/* Middle preview area depending on labelMode */}
                    {labelMode === 'barcode' && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <svg ref={labelBarcodeSvgRef} style={{ maxWidth: '100%' }} />
                      </div>
                    )}

                    {labelMode === 'qr' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                        <QRCodeSVG value={currentQr || item.code} size={labelSize === '50x30' ? 68 : 84} level="M" />
                        <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                          {item.code}
                        </span>
                      </div>
                    )}

                    {labelMode === 'combo' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '2px 0' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                          <svg ref={labelBarcodeSvgRef} style={{ maxWidth: '100%' }} />
                        </div>
                        <div style={{ flexShrink: 0, padding: '2px', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <QRCodeSVG value={currentQr || item.code} size={labelSize === '50x30' ? 50 : 62} level="M" />
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#475569' }}>
                      <span>4.28<: {item.unit || 'HB'}</span>
                      <span>!BV:5@ 3>B>289 4> =0:;59:8</span>
                    </div>
                  </div>
                </div>

                {/* Hidden container to grab QR svg for print doc */}
                <div ref={labelQrContainerRef} style={{ display: 'none' }}>
                  <QRCodeSVG 
                    value={currentQr || item.code} 
                    size={labelMode === 'combo' ? (labelSize === '50x30' ? 68 : 84) : (labelSize === '50x30' ? 95 : 115)} 
                    level="M" 
                  />
                </div>

                {/* Print Trigger Button */}
                <button
                  onClick={handlePrintThermalLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    background: 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(255, 144, 0, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Printer size={20} />
                   >74@C:C20B8 {labelMode === 'barcode' ? 'HB! Q!& T U ‘' : labelMode === 'qr' ? 'QR-:>4' : ':><1> ABV:5@ ((B@8E + QR)'} ({labelSize} <<)
                </button>

                {/* Quick Info Tip */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  background: 'rgba(255, 144, 0, 0.08)',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  color: '#b45309',
                  lineHeight: 1.4
                }}>
                  <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    "5@<>-5B8:5B:0 >?B8<V7>20=0 ?V4 100% AC<VA=VABL V7 ?@8=B5@0<8 Xprinter / Zebra (157 ?>;V2, B>G=89 25:B>@=89 SVG).
                  </span>
                </div>
              </div>

            </div>
          )}

    </>
  )
}
