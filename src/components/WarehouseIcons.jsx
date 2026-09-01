import React from 'react'

/**
 * Custom Green Letter Icon for Склад Оперативний (СО)
 */
export const IconSO = ({ size = 24, color = 'currentColor', className = '', style = {}, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`icon-so ${className}`}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    {...props}
  >
    <text
      x="12"
      y="12"
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontSize="13.5"
      fontWeight="900"
      fontFamily="Inter, system-ui, -apple-system, sans-serif"
      letterSpacing="0.2px"
    >
      СО
    </text>
  </svg>
)

/**
 * Custom Green Letter Icon for Склад Виробництва (СВ)
 */
export const IconSV = ({ size = 24, color = 'currentColor', className = '', style = {}, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`icon-sv ${className}`}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    {...props}
  >
    <text
      x="12"
      y="12"
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontSize="13.5"
      fontWeight="900"
      fontFamily="Inter, system-ui, -apple-system, sans-serif"
      letterSpacing="0.2px"
    >
      СВ
    </text>
  </svg>
)

/**
 * Custom Green Letter Icon for Склад Готової Продукції (СГП) - wider viewBox & clear letter spacing
 */
export const IconSGP = ({ size = 24, color = 'currentColor', className = '', style = {}, ...props }) => {
  const width = Math.round(size * 1.15)
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 28 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`icon-sgp ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...props}
    >
      <text
        x="14"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="12.5"
        fontWeight="900"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        letterSpacing="0.4px"
      >
        СГП
      </text>
    </svg>
  )
}
