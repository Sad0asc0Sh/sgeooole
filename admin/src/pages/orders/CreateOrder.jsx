import PageHeader from '../../components/ui/PageHeader'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
    Card,
    Form,
    Input,
    Select,
    Button,
    message,
    Table,
    InputNumber,
    Space,
    Divider,
    AutoComplete,
    Spin,
} from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
    SaveOutlined,
    ArrowLeftOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons'
import api from '../../api'

const { Option } = Select
const { TextArea } = Input

function CreateOrderPage() {
    const navigate = useNavigate()
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)

    // Customer Selection
    const [customers, setCustomers] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [searchingCustomers, setSearchingCustomers] = useState(false)

    // Product Selection
    const [products, setProducts] = useState([])
    const [searchingProducts, setSearchingProducts] = useState(false)
    const [orderItems, setOrderItems] = useState([])

    // Address & Shipping
    const [addresses, setAddresses] = useState([])
    const [selectedAddress, setSelectedAddress] = useState(null)
    const [shippingMethods, setShippingMethods] = useState([])
    const [selectedShippingMethod, setSelectedShippingMethod] = useState('')

    // Pricing
    const [itemsPrice, setItemsPrice] = useState(0)
    const [shippingPrice, setShippingPrice] = useState(0)
    const [totalPrice, setTotalPrice] = useState(0)

    // Load shipping methods on mount
    useEffect(() => {
        loadShippingMethods()
    }, [])

    // Recalculate pricing when items or shipping changes
    useEffect(() => {
        calculatePricing()
    }, [orderItems, shippingPrice])

    const loadShippingMethods = async () => {
        try {
            const res = await api.get('/shipping')
            if (res.data.success) {
                const activeMethods = res.data.data.filter((m) => m.isActive)
                setShippingMethods(activeMethods)
                if (activeMethods.length > 0) {
                    setSelectedShippingMethod(activeMethods[0]._id)
                    setShippingPrice(activeMethods[0].cost || 0)
                }
            }
        } catch (err) {
            console.error('Error loading shipping methods', err)
        }
    }

    const searchCustomers = async (searchText) => {
        if (!searchText || searchText.length < 2) {
            setCustomers([])
            return
        }

        try {
            setSearchingCustomers(true)
            const res = await api.get('/users', {
                params: { search: searchText, limit: 20 },
            })
            if (res.data.success) {
                setCustomers(res.data.data)
            }
        } catch (err) {
            console.error('Error searching customers:', err)
        } finally {
            setSearchingCustomers(false)
        }
    }

    const handleCustomerSelect = async (customerId) => {
        const customer = customers.find((c) => c._id === customerId)
        if (!customer) return

        setSelectedCustomer(customer)

        // Load customer addresses
        try {
            const res = await api.get(`/users/${customerId}`)
            if (res.data.success && res.data.data.addresses) {
                setAddresses(res.data.data.addresses)

                // Auto-select default address
                const defaultAddr = res.data.data.addresses.find((a) => a.isDefault)
                if (defaultAddr) {
                    setSelectedAddress(defaultAddr)
                    form.setFieldsValue({ addressId: defaultAddr._id })
                } else if (res.data.data.addresses.length > 0) {
                    setSelectedAddress(res.data.data.addresses[0])
                    form.setFieldsValue({ addressId: res.data.data.addresses[0]._id })
                }
            }
        } catch (err) {
            console.error('Error loading customer addresses:', err)
        }
    }

    const searchProducts = async (searchText) => {
        if (!searchText || searchText.length < 2) {
            setProducts([])
            return
        }

        try {
            setSearchingProducts(true)
            const res = await api.get('/products', {
                params: { search: searchText, limit: 20 },
            })
            if (res.data.success) {
                setProducts(res.data.data)
            }
        } catch (err) {
            console.error('Error searching products:', err)
        } finally {
            setSearchingProducts(false)
        }
    }

    const handleAddProduct = (productId) => {
        const product = products.find((p) => p._id === productId)
        if (!product) return

        // Check if product already exists
        const exists = orderItems.find((item) => item.product === productId)
        if (exists) {
            message.warning('این محصول قبلاً اضافه شده است')
            return
        }

        const newItem = {
            product: product._id,
            name: product.name,
            quantity: 1,
            price: product.price,
            image:
                product.images && product.images.length > 0
                    ? typeof product.images[0] === 'string'
                        ? product.images[0]
                        : product.images[0].url
                    : '',
        }

        setOrderItems([...orderItems, newItem])
    }

    const handleRemoveProduct = (productId) => {
        setOrderItems(orderItems.filter((item) => item.product !== productId))
    }

    const handleQuantityChange = (productId, quantity) => {
        setOrderItems(
            orderItems.map((item) =>
                item.product === productId ? { ...item, quantity } : item
            )
        )
    }

    const calculatePricing = () => {
        const items = orderItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        )
        setItemsPrice(items)
        setTotalPrice(items + shippingPrice)
    }

    const handleShippingMethodChange = (methodId) => {
        setSelectedShippingMethod(methodId)
        const method = shippingMethods.find((m) => m._id === methodId)
        if (method) {
            setShippingPrice(method.cost || 0)
        }
    }

    const handleSubmit = async (values) => {
        if (!selectedCustomer) {
            message.error('لطفاً مشتری را انتخاب کنید')
            return
        }

        if (orderItems.length === 0) {
            message.error('لطفاً حداقل یک محصول اضافه کنید')
            return
        }

        if (!selectedAddress) {
            message.error('لطفاً آدرس تحویل را انتخاب کنید')
            return
        }

        try {
            setLoading(true)

            const orderData = {
                userId: selectedCustomer._id,
                orderItems: orderItems.map((item) => ({
                    product: item.product,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    image: item.image || '',
                })),
                shippingAddress: {
                    fullName: selectedAddress.fullName,
                    phone: selectedAddress.phone || selectedAddress.mobile,
                    mobile: selectedAddress.mobile,
                    nationalCode: selectedAddress.nationalCode || '',
                    province: selectedAddress.province,
                    city: selectedAddress.city,
                    address: selectedAddress.address,
                    postalCode: selectedAddress.postalCode,
                    recipientName:
                        selectedAddress.recipientName || selectedAddress.fullName,
                    recipientPhone:
                        selectedAddress.recipientPhone || selectedAddress.mobile,
                    recipientNationalCode:
                        selectedAddress.recipientNationalCode ||
                        selectedAddress.nationalCode,
                },
                paymentMethod: values.paymentMethod || 'online',
                itemsPrice,
                shippingPrice,
                shippingMethod:
                    shippingMethods.find((m) => m._id === selectedShippingMethod)?.name ||
                    '',
                taxPrice: 0,
                totalPrice,
                totalDiscount: 0,
                adminNotes: values.adminNotes || '',
            }

            const res = await api.post('/orders/admin/create', orderData)

            if (res.data.success) {
                message.success('سفارش با موفقیت ایجاد شد')
                navigate(`/orders/${res.data.data._id}`)
            }
        } catch (error) {
            console.error('Error creating order:', error)
            message.error(error.response?.data?.message || 'خطا در ایجاد سفارش')
        } finally {
            setLoading(false)
        }
    }

    const orderItemsColumns = [
        {
            title: 'محصول',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'قیمت واحد',
            dataIndex: 'price',
            key: 'price',
            render: (price) => (
                <span>{new Intl.NumberFormat('fa-IR').format(price)} تومان</span>
            ),
        },
        {
            title: 'تعداد',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 150,
            render: (_, record) => (
                <InputNumber
                    min={1}
                    value={record.quantity}
                    onChange={(value) => handleQuantityChange(record.product, value || 1)}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: 'جمع',
            key: 'total',
            render: (_, record) => (
                <span style={{ fontWeight: 'bold' }}>
                    {new Intl.NumberFormat('fa-IR').format(record.price * record.quantity)}{' '}
                    تومان
                </span>
            ),
        },
        {
            title: 'عملیات',
            key: 'actions',
            width: 80,
            render: (_, record) => (
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveProduct(record.product)}
                />
            ),
        },
    ]

    return (
        <div>
            <PageHeader
                title="ایجاد سفارش جدید"
                actions={
                    <Link to="/orders">
                        <Button icon={<ArrowLeftOutlined />}>بازگشت به سفارش‌ها</Button>
                    </Link>
                }
            />

            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Customer Selection */}
                        <Card title="انتخاب مشتری" size="small">
                            <Form.Item
                                label="جستجوی مشتری"
                                name="customerId"
                                rules={[{ required: true, message: 'انتخاب مشتری الزامی است' }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="نام، ایمیل یا موبایل مشتری را وارد کنید"
                                    filterOption={false}
                                    onSearch={searchCustomers}
                                    onChange={handleCustomerSelect}
                                    notFoundContent={searchingCustomers ? <Spin size="small" /> : null}
                                    suffixIcon={<SearchOutlined />}
                                >
                                    {customers.map((customer) => (
                                        <Option key={customer._id} value={customer._id}>
                                            <div>
                                                <div>{customer.name || customer.email}</div>
                                                <small style={{ color: '#999' }}>
                                                    {customer.email}{' '}
                                                    {customer.mobile && `• ${customer.mobile}`}
                                                </small>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            {selectedCustomer && (
                                <div
                                    style={{
                                        background: '#f5f5f5',
                                        padding: 12,
                                        borderRadius: 8,
                                        marginTop: 8,
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                        <UserOutlined /> {selectedCustomer.name || selectedCustomer.email}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#666' }}>
                                        {selectedCustomer.email}
                                        {selectedCustomer.mobile && ` • ${selectedCustomer.mobile}`}
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Address Selection */}
                        <Card title="آدرس تحویل" size="small">
                            <Form.Item
                                label="انتخاب آدرس"
                                name="addressId"
                                rules={[{ required: true, message: 'انتخاب آدرس الزامی است' }]}
                            >
                                <Select
                                    placeholder="آدرس تحویل را انتخاب کنید"
                                    disabled={addresses.length === 0}
                                    onChange={(value) => {
                                        const addr = addresses.find((a) => a._id === value)
                                        setSelectedAddress(addr || null)
                                    }}
                                >
                                    {addresses.map((addr) => (
                                        <Option key={addr._id} value={addr._id}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{addr.fullName}</div>
                                                <small style={{ color: '#666' }}>
                                                    {addr.province}, {addr.city} - {addr.mobile}
                                                </small>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            {selectedAddress && (
                                <div
                                    style={{
                                        background: '#f5f5f5',
                                        padding: 12,
                                        borderRadius: 8,
                                        marginTop: 8,
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                        {selectedAddress.fullName}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                                        {selectedAddress.province}, {selectedAddress.city}
                                        <br />
                                        {selectedAddress.address}
                                        {selectedAddress.plaque && `, پلاک ${selectedAddress.plaque}`}
                                        {selectedAddress.unit && `, واحد ${selectedAddress.unit}`}
                                        <br />
                                        کد پستی: {selectedAddress.postalCode}
                                        <br />
                                        موبایل: {selectedAddress.mobile}
                                    </div>
                                </div>
                            )}

                            {addresses.length === 0 && selectedCustomer && (
                                <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                                    این مشتری آدرسی ثبت نکرده است
                                </div>
                            )}
                        </Card>

                        {/* Shipping & Payment */}
                        <Card title="روش ارسال و پرداخت" size="small">
                            <Form.Item label="روش ارسال" name="shippingMethodId">
                                <Select
                                    value={selectedShippingMethod}
                                    onChange={handleShippingMethodChange}
                                >
                                    {shippingMethods.map((method) => (
                                        <Option key={method._id} value={method._id}>
                                            {method.name} -{' '}
                                            {method.cost === 0
                                                ? 'رایگان'
                                                : `${new Intl.NumberFormat('fa-IR').format(method.cost)} تومان`}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                label="روش پرداخت"
                                name="paymentMethod"
                                initialValue="online"
                            >
                                <Select disabled>
                                    <Option value="online">پرداخت آنلاین (الزامی)</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label="یادداشت (اختیاری)" name="adminNotes">
                                <TextArea
                                    rows={3}
                                    placeholder="یادداشت‌های داخلی درباره این سفارش..."
                                />
                            </Form.Item>
                        </Card>
                    </div>

                    {/* Right Column */}
                    <div>
                        {/* Products */}
                        <Card
                            title="محصولات سفارش"
                            size="small"
                            extra={
                                <AutoComplete
                                    style={{ width: 300, maxWidth: '100%' }}
                                    placeholder="جستجوی محصول..."
                                    onSearch={searchProducts}
                                    onSelect={handleAddProduct}
                                    notFoundContent={searchingProducts ? <Spin size="small" /> : null}
                                >
                                    {products.map((product) => (
                                        <AutoComplete.Option key={product._id} value={product._id}>
                                            <div>
                                                <div>{product.name}</div>
                                                <small style={{ color: '#999' }}>
                                                    {new Intl.NumberFormat('fa-IR').format(product.price)}{' '}
                                                    تومان • موجودی: {product.countInStock}
                                                </small>
                                            </div>
                                        </AutoComplete.Option>
                                    ))}
                                </AutoComplete>
                            }
                        >
                            <Table
                                dataSource={orderItems}
                                columns={orderItemsColumns}
                                rowKey="product"
                                pagination={false}
                                locale={{ emptyText: 'هیچ محصولی اضافه نشده است' }}
                                size="small"
                            />

                            <Divider />

                            <div style={{ textAlign: 'right' }}>
                                <div style={{ marginBottom: 8 }}>
                                    <span>جمع کالاها: </span>
                                    <span style={{ fontWeight: 'bold' }}>
                                        {new Intl.NumberFormat('fa-IR').format(itemsPrice)} تومان
                                    </span>
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <span>هزینه ارسال: </span>
                                    <span style={{ fontWeight: 'bold' }}>
                                        {new Intl.NumberFormat('fa-IR').format(shippingPrice)} تومان
                                    </span>
                                </div>
                                <div style={{ fontSize: 16, color: '#b45309' }}>
                                    <span>مبلغ کل: </span>
                                    <span style={{ fontWeight: 'bold' }}>
                                        {new Intl.NumberFormat('fa-IR').format(totalPrice)} تومان
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        size="large"
                        loading={loading}
                        disabled={
                            !selectedCustomer || orderItems.length === 0 || !selectedAddress
                        }
                    >
                        ایجاد سفارش
                    </Button>
                </div>
            </Form>
        </div>
    )
}

export default CreateOrderPage
