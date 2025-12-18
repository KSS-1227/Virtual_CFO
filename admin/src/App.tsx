import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Package, Plus, DollarSign, Users } from 'lucide-react'

const supabase = createClient(
  'https://ixqjgfqhqjqjqjqjqjqj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpnZnFocWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzI4NzAsImV4cCI6MjA1MDU0ODg3MH0.placeholder'
)

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Technology',
    price: '',
    vendor_name: ''
  })

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').limit(10)
    setProducts(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { error } = await supabase.from('products').insert([{
        ...formData,
        price: parseFloat(formData.price),
        target_business_types: ['Electronics', 'Retail'],
        target_business_sizes: ['small', 'medium'],
        key_benefits: ['Increase sales', 'Reduce costs'],
        features: ['Easy to use', 'Cost effective']
      }])
      
      if (!error) {
        alert('Product created successfully!')
        setFormData({ name: '', description: '', category: 'Technology', price: '', vendor_name: '' })
        loadProducts()
      }
    } catch (error) {
      alert('Error creating product')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Package className="h-6 w-6 text-blue-600" />
            VirtualCFO Admin Panel
          </h1>
          <p className="text-gray-600">Manage products and services for AI recommendations</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Add Product Form */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Product
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Creating...' : 'Create Product'}
              </button>
            </form>
          </div>

          {/* Products List */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recent Products ({products.length})
            </h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {products.map((product: any) => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {product.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ₹{product.price?.toLocaleString()}
                    </span>
                    <span className="text-gray-500">{product.vendor_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App