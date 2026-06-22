import { motion } from 'framer-motion';
import { UtensilsCrossed, ChefHat, CreditCard, Settings, QrCode, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { systemSettings } from '@/data/mockData';

const Index = () => {
  const navigate = useNavigate();
  const restaurantName = systemSettings.restaurant_name;

  const roles = [
    {
      id: 'customer',
      title: 'Customer',
      description: 'Scan QR & order from your table',
      icon: QrCode,
      path: '/order',
      color: 'from-blue-500 to-cyan-500',
      iconBg: 'bg-blue-500/10',
      iconColor: '#3b82f6',
    },
    {
      id: 'kitchen',
      title: 'Kitchen',
      description: 'Manage orders & prep times',
      icon: ChefHat,
      path: '/kitchen',
      color: 'from-orange-500 to-amber-500',
      iconBg: 'bg-orange-500/10',
      iconColor: '#f97316',
    },
    {
      id: 'waiter',
      title: 'Waiter',
      description: 'Tables, calls & order tracking',
      icon: Users,
      path: '/waiter',
      color: 'from-indigo-500 to-blue-600',
      iconBg: 'bg-indigo-500/10',
      iconColor: '#6366f1',
    },
    {
      id: 'billing',
      title: 'Billing',
      description: 'Process payments & receipts',
      icon: CreditCard,
      path: '/billing',
      color: 'from-green-500 to-emerald-500',
      iconBg: 'bg-green-500/10',
      iconColor: '#22c55e',
    },
    {
      id: 'admin',
      title: 'Admin',
      description: 'Manage restaurant settings',
      icon: Settings,
      path: '/admin',
      color: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-500/10',
      iconColor: '#a855f7',
    },
  ];

  const features = [
    { icon: UtensilsCrossed, label: 'Digital Menu' },
    { icon: ChefHat, label: 'Kitchen Display' },
    { icon: Users, label: 'Waiter Tablet' },
    { icon: CreditCard, label: 'POS Billing' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">{restaurantName}</h1>
              <p className="text-xs text-muted-foreground">Digital Ordering Platform</p>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Scan, Order, Track, Pay
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Complete digital ordering system for modern restaurants.
            Select your role below to get started.
          </p>
        </motion.div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-16">
          {roles.map((role, index) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <button
                onClick={() => navigate(role.path)}
                className="w-full group"
              >
                <div className="bg-card border rounded-2xl p-6 card-hover text-left h-full">
                  <div className={`w-14 h-14 rounded-xl ${role.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <role.icon className="w-7 h-7" style={{ color: role.iconColor }} />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{role.title}</h3>
                  <p className="text-muted-foreground text-sm">{role.description}</p>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-card border rounded-2xl p-8"
        >
          <h3 className="text-center font-semibold text-lg mb-6">System Features</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm font-medium">{feature.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 {restaurantName}. QR-Based Restaurant Ordering System.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
