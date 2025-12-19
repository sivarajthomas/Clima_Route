
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Input, Select } from '../components/Layout';
import { apiService } from '../services/apiservice';
import { User, Bell, Shield, Globe, Smartphone, Mail, Save, Lock, Truck } from 'lucide-react';

export default function Settings() {
   const [loading, setLoading] = useState(false);
   const { user } = useAuth();
   const [temperatureUnit, setTemperatureUnit] = useState<'C'|'F'>('C');
   const [distanceUnit, setDistanceUnit] = useState<'km'|'mi'>('km');
   const [timeFormat, setTimeFormat] = useState<'12'|'24'>('24');
   const [language, setLanguage] = useState('en-US');
   const [userPassword, setUserPassword] = useState<string>('********');
   const [userName, setUserName] = useState<string>('');
   const [userEmail, setUserEmail] = useState<string>('');
   const [userPhone, setUserPhone] = useState<string>('');
   const [userId, setUserId] = useState<number | null>(null);

   const handleSave = () => {
      if (!user?.email || !userId) return;
      setLoading(true);
      (async () => {
         try {
            // Save settings
            await apiService.updateUserSettings(user.email, { 
               TemperatureUnit: temperatureUnit, 
               DistanceUnit: distanceUnit, 
               TimeFormat: timeFormat, 
               Language: language 
            });
            
            // Save profile information
            const profileData: any = {
               name: userName,
               email: userEmail,
               phone: userPhone,
               password: userPassword
            };
            await apiService.updateUser(userId, profileData);
            
            // Update localStorage with new user data
            const updatedUser = {
               email: userEmail,
               name: userName,
               role: user.role
            };
            localStorage.setItem('clima_user', JSON.stringify(updatedUser));
            
            // Refresh page to update auth context
            alert('Profile updated successfully!');
            window.location.reload();
         } catch (err) {
            console.error('Save settings failed', err);
            alert('Failed to save changes. Please try again.');
         } finally {
            setLoading(false);
         }
      })();
   };

   // Load current settings for the user on mount
   React.useEffect(() => {
      (async () => {
         if (!user?.email) return;
         try {
            // Load user settings
            const s: any = await apiService.getUserSettings(user.email);
            if (s) {
               if (s.temperatureUnit) setTemperatureUnit(s.temperatureUnit === 'F' ? 'F' : 'C');
               if (s.temperatureUnit === undefined && s.TemperatureUnit) setTemperatureUnit(s.TemperatureUnit === 'F' ? 'F' : 'C');
               if (s.distanceUnit) setDistanceUnit(s.distanceUnit === 'mi' ? 'mi' : 'km');
               if (s.distanceUnit === undefined && s.DistanceUnit) setDistanceUnit(s.DistanceUnit === 'mi' ? 'mi' : 'km');
               if (s.timeFormat) setTimeFormat(s.timeFormat === '12' ? '12' : '24');
               if (s.TimeFormat) setTimeFormat(s.TimeFormat === '12' ? '12' : '24');
               if (s.language) setLanguage(s.language);
               if (s.Language) setLanguage(s.Language);
            }
            
            // Fetch user data to get all profile information
            const users: any = await apiService.getUsers();
            const currentUser = users?.find((u: any) => u.email === user.email);
            if (currentUser) {
               setUserId(currentUser.id);
               setUserName(currentUser.name || '');
               setUserEmail(currentUser.email || '');
               setUserPhone(currentUser.phone || '+1 (555) 123-4567');
               setUserPassword(currentUser.password || '********');
            }
         } catch (e) { console.error(e); }
      })();
   }, [user?.email]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your profile and application preferences</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="shadow-lg shadow-blue-900/20 w-full sm:w-auto">
           <Save size={18} />
           {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profile */}
        <div className="space-y-6">
          <Card title="Profile Information">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 border-4 border-white shadow-sm relative">
                <User size={40} />
                <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 border-2 border-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-800">{user?.name ?? 'Your Name'}</h3>
              <p className="text-sm text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'Fleet Driver'}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                <Input value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="pl-10" />
                </div>
              </div>
               <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                <div className="relative">
                   <Smartphone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <Input value={userPhone} onChange={(e) => setUserPhone(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                <div className="relative">
                   <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <Input type="text" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} className="pl-10" />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Fleet Details">
             <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                   <Truck size={24} />
                </div>
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold">Current Vehicle</p>
                   <p className="font-semibold text-gray-800">Volvo VNL 860 (2023)</p>
                   <p className="text-sm text-gray-500 mt-1">ID: #FLT-8834</p>
                </div>
             </div>
             <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-600">License Status</span>
                   <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">Active</span>
                </div>
             </div>
          </Card>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card title="General Preferences" className="relative overflow-hidden">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Globe size={16} /> Language
                   </label>
                   <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en-US">English (US)</option>
                   </Select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Time Format</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => setTimeFormat('12')} className={`flex-1 py-1.5 text-sm font-medium rounded ${timeFormat==='12' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>12-hour</button>
                      <button onClick={() => setTimeFormat('24')} className={`flex-1 py-1.5 text-sm font-medium rounded ${timeFormat==='24' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>24-hour</button>
                   </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Distance Units</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => setDistanceUnit('mi')} className={`flex-1 py-1.5 text-sm font-medium rounded ${distanceUnit==='mi' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>Miles</button>
                      <button onClick={() => setDistanceUnit('km')} className={`flex-1 py-1.5 text-sm font-medium rounded ${distanceUnit==='km' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>Km</button>
                   </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => setTemperatureUnit('F')} className={`flex-1 py-1.5 text-sm font-medium rounded ${temperatureUnit==='F' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>°F Fahrenheit</button>
                      <button onClick={() => setTemperatureUnit('C')} className={`flex-1 py-1.5 text-sm font-medium rounded ${temperatureUnit==='C' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>°C Celsius</button>
                   </div>
                </div>
             </div>
          </Card>

          <Card title="Notifications" action={<Bell size={20} className="text-gray-400"/>}>
             <div className="space-y-4">
                {[
                   { title: 'Critical Weather Alerts', desc: 'Get immediate alerts for severe weather conditions on your route.', checked: true },
                   { title: 'Route Deviations', desc: 'Notify when re-routing suggestions are available.', checked: true },
                   { title: 'Rest Stop Reminders', desc: 'Reminders to take breaks based on driving hours.', checked: true },
                ].map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="pr-4">
                         <p className="font-medium text-gray-800">{item.title}</p>
                         <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" defaultChecked={item.checked} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                   </div>
                ))}
             </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
