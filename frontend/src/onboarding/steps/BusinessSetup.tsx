import { useState, useEffect } from 'react';
import { MapPin, Store, Users, Shield, Star, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';

const businessTypes = [
  { id: 'electronics', name: 'Electronics', icon: '📱', popular: true },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', popular: true },
  { id: 'clothing', name: 'Clothing', icon: '👕', popular: true },
  { id: 'grocery', name: 'Grocery', icon: '🛒', popular: true },
  { id: 'medical', name: 'Medical Store', icon: '💊', popular: false },
  { id: 'salon', name: 'Salon/Beauty', icon: '💄', popular: false },
  { id: 'auto', name: 'Auto Parts', icon: '🔧', popular: false },
  { id: 'services', name: 'Services', icon: '🛠️', popular: false }
];

export function BusinessSetup() {
  const { businessData, updateBusinessData } = useOnboardingProgress();
  const [userLocation, setUserLocation] = useState('');

  // Auto-detect location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const location = `${data.city}, ${data.principalSubdivision}`;
            setUserLocation(location);
            if (!businessData.location) {
              updateBusinessData({ location });
            }
          } catch (error) {
            console.log('Location detection failed');
          }
        },
        () => console.log('Location permission denied')
      );
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Store className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Tell us about your business</h2>
        <p className="text-gray-600">
          We'll personalize your experience and provide relevant insights for your business type.
        </p>
      </div>

      {/* Trust Indicators */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-green-700">
            <Shield className="w-4 h-4" />
            <span>🔒 Your data is encrypted and secure</span>
          </div>
          <div className="flex items-center gap-2 text-green-700">
            <Users className="w-4 h-4" />
            <span>Join 12,847+ successful shop owners</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Business Name */}
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            placeholder="e.g., Sharma Electronics Store"
            value={businessData.name}
            onChange={(e) => updateBusinessData({ name: e.target.value })}
            className="text-lg"
          />
        </div>

        {/* Business Type */}
        <div className="space-y-3">
          <Label>Business Type *</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {businessTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => updateBusinessData({ type: type.id })}
                className={`
                  relative p-4 rounded-lg border-2 text-center transition-all hover:shadow-md
                  ${businessData.type === type.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                {type.popular && (
                  <Badge className="absolute -top-2 -right-2 bg-orange-500 text-xs">
                    Popular
                  </Badge>
                )}
                <div className="text-2xl mb-2">{type.icon}</div>
                <div className="text-sm font-medium">{type.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location *
          </Label>
          <Input
            id="location"
            placeholder="City, State"
            value={businessData.location}
            onChange={(e) => updateBusinessData({ location: e.target.value })}
          />
          {userLocation && businessData.location !== userLocation && (
            <button
              onClick={() => updateBusinessData({ location: userLocation })}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Use detected location: {userLocation}
            </button>
          )}
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Phone Number *
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="9876543210"
            value={businessData.phone}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 10);
              updateBusinessData({ phone: value });
            }}
            maxLength={10}
          />
          <div className="text-xs text-gray-500">
            Enter 10-digit mobile number (for order notifications & support)
          </div>
        </div>

        {/* Business Size */}
        <div className="space-y-2">
          <Label>Business Size</Label>
          <Select 
            value={businessData.size} 
            onValueChange={(value) => updateBusinessData({ size: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small (1-10 employees)</SelectItem>
              <SelectItem value="medium">Medium (11-50 employees)</SelectItem>
              <SelectItem value="large">Large (50+ employees)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Local Testimonial */}
      {businessData.type && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
              R
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Rajesh Kumar</span>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                "VirtualCFO helped me increase my {businessTypes.find(t => t.id === businessData.type)?.name.toLowerCase()} store profits by 35% in just 3 months!"
              </p>
              <div className="text-xs text-gray-500 mt-1">
                {businessTypes.find(t => t.id === businessData.type)?.name} Store Owner, Mumbai
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}