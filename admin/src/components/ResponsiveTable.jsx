import { Table, Checkbox, Pagination, Empty, Skeleton, Button } from 'antd'
import useIsMobile from '../hooks/useIsMobile'
import './ResponsiveTable.css'

/**
 * ResponsiveTable — drop-in wrapper around antd <Table>.
 *
 * Desktop (>=768px): renders a normal antd Table (all props forwarded).
 * Mobile  (<768px):  renders each row as a tappable card built from the
 *                    column metadata, with pagination / selection / actions.
 *
 * Column extras (all optional):
 *   - mobile: false      → hide this column from mobile cards
 *   - mobileTitle: true  → use this column's value as the card title
 *   - mobileBadge: true  → pin this column to the card header as a badge
 *   - key 'actions' / title 'عملیات' → rendered as the card action row
 *
 * Extra props: mobileHiddenFields[], mobilePrimaryField
 */
export default function ResponsiveTable({
  columns = [],
  dataSource = [],
  rowKey = 'key',
  loading = false,
  pagination,
  rowSelection,
  onRow,
  locale,
  size,
  bordered,
  scroll,
  className = '',
  mobileHiddenFields = [],
  mobilePrimaryField,
  ...rest
}) {
  const isMobile = useIsMobile(768)

  const getRecordKey = (record, index) =>
    typeof rowKey === 'function' ? rowKey(record, index) : record?.[rowKey]

  const resolveValue = (record, col) => {
    if (!col) return undefined
    const path = Array.isArray(col.dataIndex)
      ? col.dataIndex
      : [col.dataIndex ?? col.key]
    let val = record
    for (const seg of path) {
      if (val == null || typeof val !== 'object') {
        val = undefined
        break
      }
      val = val[seg]
    }
    return val
  }

  const renderCell = (col, record, index) => {
    const raw = resolveValue(record, col)
    if (typeof col.render === 'function') {
      try {
        return col.render(raw, record, index ?? 0)
      } catch {
        return raw
      }
    }
    return raw
  }

  // ── DESKTOP: native table ──
  if (!isMobile) {
    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        pagination={pagination}
        rowSelection={rowSelection}
        onRow={onRow}
        locale={locale}
        size={size}
        bordered={bordered}
        scroll={scroll}
        className={className}
        {...rest}
      />
    )
  }

  // ── MOBILE: card list ──
  const cols = Array.isArray(columns) ? columns : []
  const isActionsCol = (c) =>
    c?.key === 'actions' ||
    c?.key === 'action' ||
    c?.title === 'عملیات' ||
    c?.mobile === 'actions'

  const hiddenSet = new Set(mobileHiddenFields)

  const fieldCols = cols.filter((c) => {
    if (isActionsCol(c)) return false
    if (c.mobile === false) return false
    const id = Array.isArray(c.dataIndex) ? c.dataIndex.join('.') : c.dataIndex
    return !(hiddenSet.has(id) || hiddenSet.has(c.key))
  })

  const titleCol =
    cols.find((c) => c.mobileTitle) ??
    (mobilePrimaryField
      ? fieldCols.find(
          (c) =>
            (Array.isArray(c.dataIndex)
              ? c.dataIndex.join('.')
              : c.dataIndex) === mobilePrimaryField,
        )
      : undefined) ??
    fieldCols[0]

  const actionsCol = cols.find(isActionsCol)

  // Optional thumbnail pinned next to the card title (e.g. product photo)
  const thumbCol = cols.find((c) => c.mobileThumb)

  const list = Array.isArray(dataSource) ? dataSource : []

  let pageItems = list
  const pgSize = pagination?.pageSize
  if (
    pagination &&
    typeof pagination === 'object' &&
    typeof pgSize === 'number' &&
    list.length > pgSize
  ) {
    const cur = pagination.current || 1
    pageItems = list.slice((cur - 1) * pgSize, cur * pgSize)
  }

  const handleCardClick = (record, index) => {
    if (typeof onRow !== 'function') return
    const rowProps = onRow(record, index) || {}
    if (typeof rowProps.onClick === 'function') rowProps.onClick()
    else if (typeof rowProps.onDoubleClick === 'function')
      rowProps.onDoubleClick()
  }

  const isSelected = (key) =>
    rowSelection && Array.isArray(rowSelection.selectedRowKeys)
      ? rowSelection.selectedRowKeys.includes(key)
      : false

  const toggleSelect = (key) => {
    if (!rowSelection || typeof rowSelection.onChange !== 'function') return
    const current = rowSelection.selectedRowKeys || []
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key]
    rowSelection.onChange(
      next,
      list.filter((r) => next.includes(getRecordKey(r))),
    )
  }

  const emptyNode = locale?.emptyText ?? <Empty description="داده‌ای یافت نشد" />

  if (loading) {
    return (
      <div className={`rt-wrap ${className}`}>
        {[1, 2, 3].map((i) => (
          <div className="rt-card" key={i}>
            <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (list.length === 0) {
    return <div className={`rt-wrap rt-empty ${className}`}>{emptyNode}</div>
  }

  return (
    <div className={`rt-wrap ${className}`}>
      {rowSelection && (rowSelection.selectedRowKeys?.length ?? 0) > 0 && (
        <div className="rt-selection-bar">
          <span>{rowSelection.selectedRowKeys.length} مورد انتخاب شده</span>
          <Button size="small" onClick={() => rowSelection.onChange([])}>
            لغو انتخاب
          </Button>
        </div>
      )}

      {pageItems.map((record, idx) => {
        const key = getRecordKey(record, idx)
        const selected = isSelected(key)
        const badges = fieldCols.filter((c) => c.mobileBadge && c !== titleCol)
        const bodyFields = fieldCols.filter(
          (c) => c !== titleCol && !c.mobileBadge,
        )
        return (
          <div
            key={key ?? idx}
            className={`rt-card ${selected ? 'rt-card-selected' : ''} ${
              onRow ? 'rt-clickable' : ''
            }`}
            onClick={() => handleCardClick(record, idx)}
          >
            <div className="rt-card-head">
              <div className="rt-card-head-main">
                {rowSelection && (
                  <Checkbox
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(key)}
                  />
                )}
                <span className="rt-card-title rt-with-thumb">
                  {thumbCol && (
                    <span className="rt-thumb">
                      {renderCell(thumbCol, record, idx)}
                    </span>
                  )}
                  <span className="rt-title-text">
                    {titleCol ? renderCell(titleCol, record, idx) : `#${idx + 1}`}
                  </span>
                </span>
              </div>
              {badges.length > 0 && (
                <div className="rt-card-badges">
                  {badges.map((c, i) => (
                    <span className="rt-badge" key={i}>
                      {renderCell(c, record, idx)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {bodyFields.length > 0 && (
              <div className="rt-card-body">
                {bodyFields.map((c, i) => {
                  const label = typeof c.title === 'string' ? c.title : c.key
                  return (
                    <div className="rt-field" key={i}>
                      <span className="rt-field-label">{label}</span>
                      <span className="rt-field-value">
                        {renderCell(c, record, idx) ?? '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {actionsCol && (
              <div
                className="rt-card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {renderCell(actionsCol, record, idx)}
              </div>
            )}
          </div>
        )
      })}

      {pagination &&
      typeof pagination === 'object' &&
      pagination !== false &&
      (pagination.total ?? list.length) > 0 && (
        <div className="rt-pagination">
          <Pagination
            size="small"
            current={pagination.current || 1}
            pageSize={pagination.pageSize || 10}
            total={pagination.total ?? list.length}
            showTotal={pagination.showTotal}
            showSizeChanger={false}
            onChange={
              pagination.onChange ??
              ((page, pageSize) =>
                rest.onChange?.({
                  current: page,
                  pageSize,
                }))
            }
          />
        </div>
      )}
    </div>
  )
}