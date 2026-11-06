import PageHeader from '../../components/ui/PageHeader'
import { useEffect, useState } from 'react'
import {
  Card,
  Tree,
  TreeSelect,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Checkbox,
  InputNumber,
  Switch,
  message,
  Space,
  Spin,
  Popconfirm,
  Divider,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  HomeOutlined,
  UpOutlined,
  DownOutlined,
  CloseCircleFilled,
  SettingOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useCategoryStore } from '../../stores'
import api from '../../api'
import { PERMISSIONS } from '../../rbac/permissions'
import { useCan } from '../../rbac/useCan'

// Flatten the antd tree keeping homepage placement metadata
const flattenTreeWithMeta = (nodes = [], acc = []) => {
  nodes.forEach((node) => {
    acc.push(node)
    if (node.children && node.children.length > 0) {
      flattenTreeWithMeta(node.children, acc)
    }
  })
  return acc
}

// ============================================================
// Homepage categories manager — replaces the legacy
// "featured / popular" section with a curated, ordered
// carousel picker for the storefront homepage.
// ============================================================
function HomepageCategoriesCard({ canUpdate }) {
  const categoriesTree = useCategoryStore((state) => state.categoriesTree)
  const fetchCategoriesTree = useCategoryStore((state) => state.fetchCategoriesTree)
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)

  const allNodes = flattenTreeWithMeta(categoriesTree)
  const homeNodes = allNodes
    .filter((n) => n.showOnHomepage)
    .sort((a, b) => (a.homepageOrder || 0) - (b.homepageOrder || 0))
  const homeIds = new Set(homeNodes.map((n) => String(n._id || n.key)))

  const markDisabled = (nodes = []) =>
    nodes.map((n) => ({
      ...n,
      disabled: homeIds.has(String(n.key)),
      children: markDisabled(n.children || []),
    }))

  const persistOrder = async (list) => {
    await Promise.all(
      list.map((node, index) =>
        api.put(`/categories/${node._id || node.key}`, { homepageOrder: index }),
      ),
    )
  }

  const handleAdd = async () => {
    if (!selectedId) {
      message.warning('ابتدا یک دسته‌بندی انتخاب کنید')
      return
    }
    try {
      setBusy(true)
      await api.put(`/categories/${selectedId}`, {
        showOnHomepage: true,
        homepageOrder: homeNodes.length,
      })
      message.success('دسته‌بندی به صفحه اصلی اضافه شد')
      setSelectedId(null)
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در افزودن دسته‌بندی به صفحه اصلی')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (node) => {
    try {
      setBusy(true)
      await api.put(`/categories/${node._id || node.key}`, { showOnHomepage: false })
      const remaining = homeNodes.filter((n) => String(n._id || n.key) !== String(node._id || node.key))
      await persistOrder(remaining)
      message.success('دسته‌بندی از صفحه اصلی حذف شد')
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در حذف دسته‌بندی از صفحه اصلی')
    } finally {
      setBusy(false)
    }
  }

  const handleMove = async (node, dir) => {
    const index = homeNodes.findIndex(
      (n) => String(n._id || n.key) === String(node._id || node.key),
    )
    const target = index + dir
    if (index < 0 || target < 0 || target >= homeNodes.length) return

    const next = [...homeNodes]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)

    try {
      setBusy(true)
      await persistOrder(next)
      message.success('ترتیب دسته‌بندی‌های صفحه اصلی به‌روزرسانی شد')
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در تغییر ترتیب')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={
        <Space>
          <HomeOutlined style={{ color: '#d97706' }} />
          <span>دسته‌بندی‌های صفحه اصلی</span>
          <Tag color="gold">{homeNodes.length} دسته</Tag>
        </Space>
      }
      extra={
        <span style={{ color: '#888', fontSize: 12 }}>
          دسته‌بندی‌هایی که در کاروسل صفحه اصلی فروشگاه نمایش داده می‌شوند
        </span>
      }
      style={{ marginBottom: 24 }}
    >
      {canUpdate && (
        <Space.Compact style={{ width: '100%', marginBottom: 16, direction: 'rtl' }} size="middle">
          <TreeSelect
            treeData={markDisabled(categoriesTree)}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="انتخاب دسته‌بندی برای افزودن به صفحه اصلی..."
            treeDefaultExpandAll
            showSearch
            treeNodeFilterProp="title"
            style={{ flex: 1, minWidth: 220, textAlign: 'right' }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={busy}
            disabled={!selectedId}
          >
            افزودن به صفحه اصلی
          </Button>
        </Space.Compact>
      )}

      {homeNodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
          <HomeOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
          هنوز دسته‌بندی‌ای به صفحه اصلی اضافه نشده است.
        </div>
      ) : (
        <div>
          {homeNodes.map((node, index) => (
            <div
              key={String(node._id || node.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                background: index % 2 === 0 ? '#fafafa' : '#fff',
                borderRadius: 8,
                marginBottom: 8,
                border: '1px solid #f0f0f0',
              }}
            >
              <Space>
                <Tag color="orange">{index + 1}</Tag>
                {node.iconUrl && (
                  <img
                    src={node.iconUrl}
                    alt=""
                    style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }}
                  />
                )}
                <span style={{ fontWeight: 500 }}>{node.title}</span>
              </Space>
              {canUpdate && (
                <Space size="small">
                  <Button
                    type="text"
                    size="small"
                    icon={<UpOutlined />}
                    disabled={index === 0 || busy}
                    onClick={() => handleMove(node, -1)}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DownOutlined />}
                    disabled={index === homeNodes.length - 1 || busy}
                    onClick={() => handleMove(node, 1)}
                  />
                  <Popconfirm
                    title="حذف از صفحه اصلی؟"
                    onConfirm={() => handleRemove(node)}
                    okText="حذف"
                    cancelText="انصراف"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<CloseCircleFilled />}
                      disabled={busy}
                    />
                  </Popconfirm>
                </Space>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function CategoriesPage() {
  const { can } = useCan()
  const canCreate = can(PERMISSIONS.CATEGORY_CREATE)
  const canUpdate = can(PERMISSIONS.CATEGORY_UPDATE)
  const canDelete = can(PERMISSIONS.CATEGORY_DELETE)

  // Zustand Store - Single Source of Truth
  const categoriesTree = useCategoryStore((state) => state.categoriesTree)
  const loading = useCategoryStore((state) => state.loading)
  const fetchCategoriesTree = useCategoryStore((state) => state.fetchCategoriesTree)

  // Local State
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [form] = Form.useForm()

  // Properties (Technical Specifications) State
  const [properties, setProperties] = useState([])
  const [newPropertyName, setNewPropertyName] = useState('')
  const [newPropertyType, setNewPropertyType] = useState('select')
  const [newPropertyOptions, setNewPropertyOptions] = useState('')
  const [newPropertyUnit, setNewPropertyUnit] = useState('')
  const [newPropertyFilterable, setNewPropertyFilterable] = useState(true)
  // فیلتر سریع (سنجاق در بالای لیست) + مترادف‌های نام/مقدار
  const [newPropertyPinned, setNewPropertyPinned] = useState(false)
  const [newPropertyAliases, setNewPropertyAliases] = useState('')

  // کشف مشخصات از محصولات واقعی (GET discovered-specs)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState({ discovered: [], configured: [], backfill: null })
  const [selectedDiscovered, setSelectedDiscovered] = useState([])
  const [syncing, setSyncing] = useState(false)

  // کشف ویژگی‌ها از داده‌ی واقعی محصولات همان شاخه + همگام‌سازی با قواعد دسته
  const openDiscover = async () => {
    if (!editingCategory?._id) {
      message.info('ابتدا دسته‌بندی را ذخیره کنید، سپس مشخصات را کشف کنید.')
      return
    }
    setDiscoverOpen(true)
    setDiscovering(true)
    setSelectedDiscovered([])
    try {
      const { data } = await api.get(`/categories/${editingCategory._id}/discovered-specs`)
      const payload = data?.data || {}
      setDiscovered({
        discovered: payload.discovered || [],
        configured: payload.configured || [],
        backfill: payload.backfill || null,
      })
      setSelectedDiscovered(
        (payload.discovered || []).filter((item) => !item.isConfigured).map((item) => item.label),
      )
    } catch (error) {
      message.error(error?.response?.data?.message || 'کشف مشخصات انجام نشد')
      setDiscoverOpen(false)
    } finally {
      setDiscovering(false)
    }
  }

  const syncDiscovered = async () => {
    if (!editingCategory?._id || selectedDiscovered.length === 0) return
    setSyncing(true)
    try {
      const { data } = await api.post(
        `/categories/${editingCategory._id}/sync-discovered-properties`,
        { labels: selectedDiscovered },
      )
      message.success(data?.message || 'ویژگی‌ها همگام‌سازی شدند')
      setDiscoverOpen(false)
      try {
        const refreshed = await api.get(`/categories/${editingCategory._id}`)
        const freshProps = refreshed?.data?.data?.properties ?? refreshed?.data?.properties
        if (Array.isArray(freshProps)) setProperties(freshProps)
      } catch {
        // نمایش ندادن خطای رفرش؛ همگام‌سازی موفق بوده است
      }
    } catch (error) {
      message.error(error?.response?.data?.message || 'همگام‌سازی انجام نشد')
    } finally {
      setSyncing(false)
    }
  }

  const cloneTree = (nodes = []) =>
    nodes.map((node) => ({
      ...node,
      children: cloneTree(node.children || []),
    }))

  const removeNodeByKey = (nodes = [], key) => {
    for (let i = 0; i < nodes.length; i += 1) {
      if (String(nodes[i].key) === String(key)) {
        return nodes.splice(i, 1)[0]
      }
      const childRemoved = removeNodeByKey(nodes[i].children || [], key)
      if (childRemoved) return childRemoved
    }
    return null
  }

  const findNodeMetaByKey = (nodes = [], key) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (String(node.key) === String(key)) {
        return {
          node,
          siblings: nodes,
          index: i,
        }
      }
      const childMatch = findNodeMetaByKey(node.children || [], key)
      if (childMatch) return childMatch
    }
    return null
  }

  const moveNodeByDropInfo = (tree = [], info) => {
    const nextTree = cloneTree(tree)
    const dragKey = String(info.dragNode.key)
    const dropKey = String(info.node.key)

    const dragNode = removeNodeByKey(nextTree, dragKey)
    if (!dragNode) return null

    const dropMeta = findNodeMetaByKey(nextTree, dropKey)
    if (!dropMeta) return null

    const dropPos = String(info.node.pos || '').split('-')
    const dropIndex = Number(dropPos[dropPos.length - 1] || 0)
    const relativeDropPosition =
      typeof info.dropPosition === 'number'
        ? info.dropPosition - dropIndex
        : 0

    if (!info.dropToGap) {
      dropMeta.node.children = dropMeta.node.children || []
      dropMeta.node.children.push(dragNode)
      return nextTree
    }

    const shouldDropAsChild =
      Array.isArray(dropMeta.node.children) &&
      dropMeta.node.children.length > 0 &&
      info.node.expanded &&
      relativeDropPosition === 1

    if (shouldDropAsChild) {
      dropMeta.node.children = dropMeta.node.children || []
      dropMeta.node.children.unshift(dragNode)
      return nextTree
    }

    const insertIndex =
      relativeDropPosition === -1 ? dropMeta.index : dropMeta.index + 1
    dropMeta.siblings.splice(insertIndex, 0, dragNode)
    return nextTree
  }

  const collectHierarchyState = (nodes = [], parentId = null, result = []) => {
    nodes.forEach((node, index) => {
      result.push({
        id: String(node.key),
        parent: parentId ? String(parentId) : null,
        order: index,
      })
      if (node.children && node.children.length > 0) {
        collectHierarchyState(node.children, node.key, result)
      }
    })
    return result
  }

  const mapCurrentHierarchyState = (
    nodes = [],
    parentId = null,
    map = new Map(),
  ) => {
    nodes.forEach((node, index) => {
      const normalizedOrder = Number(node.order)
      map.set(String(node.key), {
        parent: parentId ? String(parentId) : null,
        order: Number.isFinite(normalizedOrder) ? normalizedOrder : index,
      })
      if (node.children && node.children.length > 0) {
        mapCurrentHierarchyState(node.children, node.key, map)
      }
    })
    return map
  }

  // Initial load
  useEffect(() => {
    if (!categoriesTree || categoriesTree.length === 0) {
      fetchCategoriesTree()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Normalize Upload event to fileList
  const normFileList = (e) => {
    if (Array.isArray(e)) return e
    return e?.fileList || []
  }

  // ============================================================
  // بهینه‌سازی سمت مرورگر برای تصاویر دسته‌بندی (فاز ۲ — ParsPack):
  // تصویر 320×320 (هدف 35KB) و آیکون 160×160 (هدف 20KB) با WebP.
  // بک‌اند هم همین ابعاد را استاندارد می‌کند؛ این‌جا حجم ورودی قبل
  // از ارسال کنترل می‌شود تا هیچ فایل سنگینی به سرور نرود.
  // ============================================================
  const CATEGORY_IMAGE_TARGET = { maxWidth: 320, maxHeight: 320, targetKB: 35, quality: 86 }
  const CATEGORY_ICON_TARGET = { maxWidth: 160, maxHeight: 160, targetKB: 20, quality: 86 }

  const canvasToBlob = (canvas, type, quality) =>
    new Promise((resolve) => {
      if (!canvas?.toBlob) return resolve(null)
      canvas.toBlob(resolve, type, quality)
    })

  const loadImageFromFile = (file) =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Failed to load image'))
      }
      img.src = objectUrl
    })

  const optimizeCategoryImageFile = async (file, target) => {
    if (!file) return file
    if (!file?.type?.startsWith?.('image/')) return file
    if (file.type === 'image/gif') return file
    const targetBytes = target.targetKB * 1024
    if (file.size <= targetBytes && file.type === 'image/webp') return file
    try {
      const img = await loadImageFromFile(file)
      const scale = Math.min(
        1,
        target.maxWidth / (img.naturalWidth || 1),
        target.maxHeight / (img.naturalHeight || 1)
      )
      const outWidth = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
      const outHeight = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
      const canvas = document.createElement('canvas')
      canvas.width = outWidth
      canvas.height = outHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      let bestBlob = null
      for (const quality of [target.quality / 100, 0.8, 0.74, 0.68]) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const blob = await canvasToBlob(canvas, 'image/webp', quality)
        if (!blob) continue
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob
        if (blob.size <= targetBytes) break
      }
      if (!bestBlob || bestBlob.size >= file.size) return file
      const baseName = (file.name || 'category').replace(/\.[^/.]+$/, '')
      return new File([bestBlob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
    } catch (err) {
      console.warn('[CATEGORY] Image optimization failed; uploading original.', err)
      return file
    }
  }

  // Submit handler (create / update)
  const onFinish = async (values) => {
    const isEditMode = Boolean(editingCategory && editingCategory._id)

    if (isEditMode && !canUpdate) {
      message.error('شما مجوز ویرایش دسته‌بندی را ندارید.')
      return
    }
    if (!isEditMode && !canCreate) {
      message.error('شما مجوز ایجاد دسته‌بندی را ندارید.')
      return
    }

    try {
      setSubmitting(true)

      const formData = new FormData()

      formData.append('name', values.name)
      if (values.parent) {
        formData.append('parent', values.parent)
      }
      if (values.description) {
        formData.append('description', values.description)
      }
      formData.append('showOnHomepage', values.showOnHomepage || false)
      if (values.homepageOrder !== undefined && values.homepageOrder !== null) {
        formData.append('homepageOrder', values.homepageOrder)
      }

      const hadIconBefore = Boolean(editingCategory?.iconUrl)
      const hadImageBefore = Boolean(editingCategory?.imageUrl)

      const pickNewFile = (files) => {
        if (!Array.isArray(files)) return null
        return files.find((f) => f.originFileObj) || null
      }

      const iconFile = pickNewFile(values.icon)
      if (iconFile) {
        const optimizedIcon = await optimizeCategoryImageFile(iconFile.originFileObj, CATEGORY_ICON_TARGET)
        formData.append('icon', optimizedIcon)
      } else if (hadIconBefore && (!values.icon || values.icon.length === 0)) {
        // Explicitly request icon removal when user cleared existing icon
        formData.append('removeIcon', 'true')
      }

      const imageFile = pickNewFile(values.image)
      if (imageFile) {
        const optimizedImage = await optimizeCategoryImageFile(imageFile.originFileObj, CATEGORY_IMAGE_TARGET)
        formData.append('image', optimizedImage)
      } else if (hadImageBefore && (!values.image || values.image.length === 0)) {
        // Explicitly request image removal when user cleared existing image
        formData.append('removeImage', 'true')
      }

      // Add properties as JSON string
      formData.append('properties', JSON.stringify(properties))

      if (editingCategory && editingCategory._id) {
        // Let axios handle Content-Type automatically for FormData (includes boundary)
        await api.put(`/categories/${editingCategory._id}`, formData)
        message.success('دسته‌بندی با موفقیت ویرایش شد')
      } else {
        // Let axios handle Content-Type automatically for FormData (includes boundary)
        await api.post('/categories', formData)
        message.success('دسته‌بندی با موفقیت ایجاد شد')
      }

      await fetchCategoriesTree()
      setModalVisible(false)
      setEditingCategory(null)
      setProperties([]) // Reset properties
      form.resetFields()
    } catch (error) {
      if (error?.errorFields) return
      message.error(
        error?.message || 'خطا در ذخیره‌سازی اطلاعات دسته‌بندی',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Open Modal for Create
  const handleCreate = () => {
    if (!canCreate) {
      message.error('شما مجوز ایجاد دسته‌بندی را ندارید.')
      return
    }

    setEditingCategory(null)
    setProperties([]) // Reset properties
    form.resetFields()
    setModalVisible(true)
  }

  // Open Modal for Edit
  const handleEdit = (category) => {
    if (!canUpdate) {
      message.error('شما مجوز ویرایش دسته‌بندی را ندارید.')
      return
    }

    const node = {
      ...category,
      _id: category._id || category.key,
    }
    setEditingCategory(node)
    form.setFieldsValue({
      name: node.title,
      parent: node.parent || null,
      description: node.description || '',
      showOnHomepage: node.showOnHomepage || false,
      homepageOrder: node.homepageOrder ?? 0,
      icon: node.iconUrl
        ? [
          {
            uid: '-1',
            name: 'icon',
            status: 'done',
            url: node.iconUrl,
          },
        ]
        : [],
      image: node.imageUrl
        ? [
          {
            uid: '-1',
            name: 'image',
            status: 'done',
            url: node.imageUrl,
          },
        ]
        : [],
    })
    // Load properties for editing
    setProperties(node.properties || [])
    setModalVisible(true)
  }

  // Delete Category
  const handleDelete = async (categoryId) => {
    if (!canDelete) {
      message.error('شما مجوز حذف دسته‌بندی را ندارید.')
      return
    }
    try {
      await api.delete(`/categories/${categoryId}`)
      message.success('دسته‌بندی با موفقیت حذف شد')
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در حذف دسته‌بندی')
    }
  }

  // Drag & Drop Handler (change parent + reorder siblings)
  const onDrop = async (info) => {
    if (!canUpdate) {
      message.error('شما مجوز ویرایش دسته‌بندی را ندارید.')
      return
    }
    try {
      const nextTree = moveNodeByDropInfo(categoriesTree, info)
      if (!nextTree) {
        message.error('Unable to calculate new category position.')
        return
      }

      const currentHierarchy = mapCurrentHierarchyState(categoriesTree)
      const nextHierarchy = collectHierarchyState(nextTree)

      const changedNodes = nextHierarchy.filter((item) => {
        const current = currentHierarchy.get(item.id)
        if (!current) return true

        const currentParent = current.parent ?? null
        const currentOrder = Number(current.order)
        return currentParent !== item.parent || currentOrder !== item.order
      })

      if (changedNodes.length === 0) {
        message.info('Category order is unchanged.')
        return
      }

      await Promise.all(
        changedNodes.map((item) =>
          api.put(`/categories/${item.id}`, {
            parent: item.parent,
            order: item.order,
          }),
        ),
      )
      message.success('ساختار دسته‌بندی با موفقیت به‌روزرسانی شد')
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در جابجایی دسته‌بندی')
    }
  }

  // Render Tree with Actions and icon preview
  const renderTreeNodes = (data) =>
    data.map((item) => ({
      ...item,
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.iconUrl && (
              <img
                src={item.iconUrl}
                alt="icon"
                style={{
                  width: 20,
                  height: 20,
                  objectFit: 'cover',
                  borderRadius: 4,
                }}
              />
            )}
            <span>{item.title}</span>
            {item.showOnHomepage && (
              <Tag color="gold" style={{ marginInlineStart: 4 }}>
                <HomeOutlined /> صفحه اصلی
              </Tag>
            )}
          </span>
          <Space size="small">
            {canUpdate && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                handleEdit(item)
              }}
            />
            )}
            {canDelete && (
            <Popconfirm
              title="حذف این دسته‌بندی؟"
              onConfirm={(e) => {
                e.stopPropagation()
                handleDelete(item.key)
              }}
              okText="حذف"
              cancelText="انصراف"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
            )}
          </Space>
        </div>
      ),
      children: item.children ? renderTreeNodes(item.children) : undefined,
    }))

  return (
    <div>
      <PageHeader
        title="مدیریت دسته‌بندی‌ها"
        actions={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              افزودن دسته‌بندی جدید
            </Button>
          )
        }
      />

      <Card>
        {loading && categoriesTree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="در حال دریافت دسته‌بندی‌ها..." spinning>
              <div style={{ height: 24 }} />
            </Spin>
          </div>
        ) : categoriesTree.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              color: '#999',
            }}
          >
            <p>هنوز هیچ دسته‌بندی‌ای ثبت نشده است.</p>
            <p style={{ fontSize: 12 }}>
              روی «افزودن دسته‌بندی جدید» کلیک کنید تا اولین دسته‌بندی را ایجاد
              کنید.
            </p>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <h3 style={{ marginBottom: 12 }}>
                ساختار درختی دسته‌بندی‌ها (برای جابجایی، درخت را درگ و دراپ
                کنید):
              </h3>
              <Tree
                treeData={renderTreeNodes(categoriesTree)}
                defaultExpandAll
                showLine
                draggable={canUpdate}
                onDrop={canUpdate ? onDrop : undefined}
                style={{
                  background: '#fafafa',
                  padding: 16,
                  borderRadius: 8,
                }}
              />
            </div>
          </Space>
        )}
      </Card>

      {/* Homepage carousel manager (replaces the legacy featured/popular section) */}
      <HomepageCategoriesCard canUpdate={canUpdate} />

      {/* Modal: Create/Edit Category */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingCategory(null)
          setProperties([])
          form.resetFields()
        }}
        onOk={() => form.submit()}
        title={editingCategory ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}
        okText={editingCategory ? 'ذخیره تغییرات' : 'ایجاد'}
        cancelText="انصراف"
        confirmLoading={submitting}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* 1. Name */}
          <Form.Item
            name="name"
            label="نام دسته‌بندی"
            rules={[
              {
                required: true,
                message: 'وارد کردن نام دسته‌بندی الزامی است',
              },
            ]}
          >
            <Input placeholder="مثلاً: دوربین مداربسته" />
          </Form.Item>

          {/* 2. Parent */}
          <Form.Item
            name="parent"
            label="دسته‌بندی والد (اختیاری)"
            help="در صورت خالی بودن، این دسته در سطح ریشه قرار می‌گیرد."
          >
            <TreeSelect
              treeData={categoriesTree}
              loading={loading}
              placeholder="انتخاب دسته‌بندی والد..."
              allowClear
              showSearch
              treeDefaultExpandAll
              filterTreeNode={(input, node) =>
                node.title.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {/* 3. Description */}
          <Form.Item name="description" label="توضیحات (اختیاری)">
            <Input.TextArea rows={3} placeholder="توضیحات کوتاه درباره دسته‌بندی" />
          </Form.Item>

          {/* 4. Icon */}
          <Form.Item
            name="icon"
            label="آیکون دسته‌بندی (اختیاری)"
            help="برای نمایش درخت و لیست‌ها — به‌صورت خودکار به 160×160 (هدف 20KB) بهینه می‌شود."
            valuePropName="fileList"
            getValueFromEvent={normFileList}
          >
            <Upload.Dragger
              maxCount={1}
              accept="image/*"
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                آیکون را بکشید و رها کنید یا برای انتخاب کلیک کنید.
              </p>
            </Upload.Dragger>
          </Form.Item>

          {/* 5. Image */}
          <Form.Item
            name="image"
            label="تصویر دسته‌بندی (اختیاری)"
            help="این تصویر در دایره‌ی دسته‌بندی صفحه اصلی نمایش داده می‌شود — به‌صورت خودکار به 320×320 (هدف 35KB) بهینه می‌شود."
            valuePropName="fileList"
            getValueFromEvent={normFileList}
          >
            <Upload.Dragger
              maxCount={1}
              accept="image/*"
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                تصویر را بکشید و رها کنید یا برای انتخاب کلیک کنید.
              </p>
            </Upload.Dragger>
          </Form.Item>

          {/* 6. Homepage placement */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 16px',
              background: '#fafafa',
              borderRadius: 8,
              border: '1px solid #f0f0f0',
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 500 }}>
                  <HomeOutlined style={{ color: '#d97706', marginLeft: 6 }} />
                  نمایش در صفحه اصلی
                </span>
                <span style={{ color: '#888', fontSize: 12 }}>
                  این دسته‌بندی در کاروسل دسته‌بندی‌های صفحه اصلی فروشگاه نمایش داده می‌شود.
                </span>
              </Space>
            </div>
            <Space>
              <Form.Item name="homepageOrder" noStyle>
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: 90 }}
                  addonAfter="ترتیب"
                />
              </Form.Item>
              <Form.Item name="showOnHomepage" valuePropName="checked" noStyle>
                <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
              </Form.Item>
            </Space>
          </div>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.showOnHomepage !== cur.showOnHomepage}>
            {({ getFieldValue }) =>
              getFieldValue('showOnHomepage') ? (
                <p style={{ color: '#d97706', fontSize: 12, marginBottom: 16 }}>
                  ترتیب نمایش در کاروسل صفحه اصلی: عدد کوچک‌تر جلوتر نمایش داده می‌شود. (مدیریت کامل در بخش «دسته‌بندی‌های صفحه اصلی» پایین همین صفحه)
                </p>
              ) : null
            }
          </Form.Item>

          <Divider orientation="right">
            <Space>
              <SettingOutlined />
              <span>ویژگی‌های فنی (مشخصات)</span>
            </Space>
          </Divider>

          {/* 8. Properties (Technical Specifications) */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
              ویژگی‌های فنی برای محصولات این دسته‌بندی را تعریف کنید. این ویژگی‌ها در فرم ایجاد محصول و فیلترهای صفحه محصولات نمایش داده می‌شوند.
            </p>

            <Space style={{ marginBottom: 12 }} wrap>
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={openDiscover}
                disabled={!editingCategory?._id}
              >
                کشف مشخصات از محصولات
              </Button>
              <span style={{ color: '#999', fontSize: 11 }}>
                ویژگی‌های واقعی موجود در محصولات این شاخه را می‌خواند و امکان افزودن آن‌ها را می‌دهد.
              </span>
            </Space>

            {/* List of existing properties */}
            {properties.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {properties.map((prop, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: 8,
                      marginBottom: 8,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Tag color="blue">{prop.name}</Tag>
                        <Tag color="green">{prop.type === 'select' ? 'انتخابی' : prop.type === 'number' ? 'عددی' : 'متنی'}</Tag>
                        {prop.unit && <Tag color="orange">{prop.unit}</Tag>}
                        {prop.isFilterable && <Tag color="purple">قابل فیلتر</Tag>}
                        {prop.isPinned && <Tag color="gold">فیلتر سریع</Tag>}
                        {Array.isArray(prop.aliases) && prop.aliases.length > 0 && (
                          <Tag color="default">مترادف: {prop.aliases.join(' ، ')}</Tag>
                        )}
                      </Space>
                      {prop.type === 'select' && prop.options && prop.options.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                          گزینه‌ها: {prop.options.join(' ، ')}
                        </div>
                      )}
                      {prop.valueAliases && Object.keys(prop.valueAliases).length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                          نگاشت مقادیر: {Object.entries(prop.valueAliases).map(([from, to]) => `${from}→${to}`).join(' ، ')}
                        </div>
                      )}
                    </div>
                    <Popconfirm
                      title="حذف این ویژگی؟"
                      onConfirm={() => {
                        const newProps = [...properties]
                        newProps.splice(index, 1)
                        setProperties(newProps)
                        message.success('ویژگی حذف شد')
                      }}
                      okText="حذف"
                      cancelText="انصراف"
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}

            {/* Add new property form */}
            <Card size="small" title="افزودن ویژگی جدید" style={{ background: '#fafafa' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Input
                    placeholder="نام ویژگی (مثلاً: رزولوشن)"
                    value={newPropertyName}
                    onChange={(e) => setNewPropertyName(e.target.value)}
                    style={{ flex: 1, minWidth: 150 }}
                  />
                  <Select
                    value={newPropertyType}
                    onChange={setNewPropertyType}
                    style={{ width: 100, maxWidth: '100%' }}
                    options={[
                      { value: 'select', label: 'انتخابی' },
                      { value: 'text', label: 'متنی' },
                      { value: 'number', label: 'عددی' },
                    ]}
                  />
                  <Input
                    placeholder="واحد (اختیاری)"
                    value={newPropertyUnit}
                    onChange={(e) => setNewPropertyUnit(e.target.value)}
                    style={{ width: 100, maxWidth: '100%' }}
                  />
                </div>

                {newPropertyType === 'select' && (
                  <Input
                    placeholder="گزینه‌ها (با ویرگول جدا کنید: 2MP, 4MP, 8MP)"
                    value={newPropertyOptions}
                    onChange={(e) => setNewPropertyOptions(e.target.value)}
                  />
                )}

                <Input
                  placeholder="مترادف‌های نام (اختیاری، با ویرگول: حافظه, storage)"
                  value={newPropertyAliases}
                  onChange={(e) => setNewPropertyAliases(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Space wrap>
                    <Checkbox
                      checked={newPropertyFilterable}
                      onChange={(e) => setNewPropertyFilterable(e.target.checked)}
                    >
                      نمایش در فیلترهای صفحه محصولات
                    </Checkbox>
                    <Checkbox
                      checked={newPropertyPinned}
                      onChange={(e) => setNewPropertyPinned(e.target.checked)}
                    >
                      سنجاق در فیلترهای سریع
                    </Checkbox>
                  </Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (!newPropertyName.trim()) {
                        message.warning('نام ویژگی را وارد کنید')
                        return
                      }

                      const newProp = {
                        name: newPropertyName.trim(),
                        type: newPropertyType,
                        options: newPropertyType === 'select'
                          ? newPropertyOptions.split(',').map(o => o.trim()).filter(Boolean)
                          : [],
                        unit: newPropertyUnit.trim(),
                        isFilterable: newPropertyFilterable,
                        isPinned: newPropertyPinned,
                        aliases: newPropertyAliases.split(',').map(a => a.trim()).filter(Boolean),
                        order: properties.length,
                      }

                      setProperties([...properties, newProp])
                      setNewPropertyName('')
                      setNewPropertyOptions('')
                      setNewPropertyUnit('')
                      setNewPropertyAliases('')
                      setNewPropertyFilterable(true)
                      setNewPropertyPinned(false)
                      message.success('ویژگی اضافه شد')
                    }}
                  >
                    افزودن
                  </Button>
                </div>
              </Space>
            </Card>

            {/* کشف مشخصات از محصولات واقعی */}
            <Modal
              title="کشف مشخصات فنی از محصولات"
              open={discoverOpen}
              onCancel={() => setDiscoverOpen(false)}
              onOk={syncDiscovered}
              okText={syncing ? 'در حال همگام‌سازی…' : `افزودن ${selectedDiscovered.length} ویژگی`}
              cancelText="انصراف"
              confirmLoading={syncing}
              okButtonProps={{ disabled: discovering || selectedDiscovered.length === 0 }}
              width={720}
            >
              {discovering ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Spin />
                </div>
              ) : (
                <>
                  <p style={{ color: '#666', fontSize: 12 }}>
                    این فهرست از مقادیر واقعی محصولات همین شاخه ساخته شده است.
                    ویژگی‌هایی که از قبل تعریف شده‌اند با برچسب «تعریف‌شده» مشخص شده‌اند و بازنویسی نمی‌شوند.
                  </p>
                  {discovered.backfill && (
                    <p style={{ color: '#888', fontSize: 12 }}>
                      محصولات بررسی‌شده: {Number(discovered.backfill.scanned || 0).toLocaleString('fa-IR')} —
                      به‌روزرسانی‌شده: {Number(discovered.backfill.updated || 0).toLocaleString('fa-IR')}
                    </p>
                  )}
                  {discovered.discovered.length === 0 ? (
                    <p style={{ color: '#999' }}>مشخصاتی در محصولات این شاخه یافت نشد.</p>
                  ) : (
                    <Checkbox.Group
                      style={{ display: 'block', maxHeight: 360, overflowY: 'auto' }}
                      value={selectedDiscovered}
                      onChange={setSelectedDiscovered}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {discovered.discovered.map((item) => (
                          <Checkbox key={item.label} value={item.label} disabled={item.isConfigured}>
                            <Space wrap>
                              <Tag color="blue">{item.label}</Tag>
                              {item.isConfigured && <Tag color="green">تعریف‌شده</Tag>}
                              <span style={{ fontSize: 11, color: '#888' }}>
                                پوشش: {Number(item.coverage || 0).toLocaleString('fa-IR')} —
                                مقادیر: {(item.values || []).slice(0, 6).map((v) => v.value).join(' ، ')}
                              </span>
                            </Space>
                          </Checkbox>
                        ))}
                      </Space>
                    </Checkbox.Group>
                  )}
                </>
              )}
            </Modal>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default CategoriesPage
