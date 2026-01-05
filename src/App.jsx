import React, { useState, useEffect } from 'react';
import { Calendar, TrendingDown, Award, Plus, LogOut, User, Droplet } from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  doc,
  getDoc
} from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('doses');
  const [doses, setDoses] = useState([]);
  const [weights, setWeights] = useState([]);
  const [showAddDose, setShowAddDose] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [doseForm, setDoseForm] = useState({ date: '', dosage: '', time: '', notes: '' });
  const [weightForm, setWeightForm] = useState({ date: '', weight: '', notes: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const allowedDoc = await getDoc(doc(db, 'allowedUsers', currentUser.email));
        if (allowedDoc.exists() && allowedDoc.data().allowed) {
          setUser(currentUser);
          loadUserData(currentUser.email);
        } else {
          await signOut(auth);
          alert('❌ Acesso negado! Seu email não está autorizado.');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (email) => {
    try {
      const dosesQuery = query(
        collection(db, 'doses'),
        where('userEmail', '==', email),
        orderBy('date', 'desc')
      );
      const dosesSnapshot = await getDocs(dosesQuery);
      const dosesData = dosesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDoses(dosesData);

      const weightsQuery = query(
        collection(db, 'weights'),
        where('userEmail', '==', email),
        orderBy('date', 'desc')
      );
      const weightsSnapshot = await getDocs(weightsQuery);
      const weightsData = weightsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWeights(weightsData);

      await loadRanking();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const loadRanking = async () => {
    try {
      const weightsSnapshot = await getDocs(collection(db, 'weights'));
      const allWeights = {};
      
      weightsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!allWeights[data.userEmail]) {
          allWeights[data.userEmail] = [];
        }
        allWeights[data.userEmail].push(data);
      });

      const rankData = Object.entries(allWeights)
        .map(([email, userWeights]) => {
          if (userWeights.length < 2) return null;
          const sorted = userWeights.sort((a, b) => new Date(a.date) - new Date(b.date));
          const initial = sorted[0].weight;
          const current = sorted[sorted.length - 1].weight;
          const loss = initial - current;
          return {
            email: email.split('@')[0],
            initial,
            current,
            loss: loss.toFixed(1),
            percentage: ((loss / initial) * 100).toFixed(1)
          };
        })
        .filter(Boolean)
        .sort((a, b) => parseFloat(b.loss) - parseFloat(a.loss));

      setRanking(rankData);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Erro no login:', error);
      alert('Erro ao fazer login');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const addDose = async () => {
    if (!doseForm.date || !doseForm.dosage) return;
    try {
      await addDoc(collection(db, 'doses'), {
        ...doseForm,
        userEmail: user.email,
        createdAt: new Date().toISOString()
      });
      setShowAddDose(false);
      setDoseForm({ date: '', dosage: '', time: '', notes: '' });
      loadUserData(user.email);
    } catch (error) {
      console.error('Erro ao adicionar dose:', error);
      alert('Erro ao adicionar dose');
    }
  };

  const addWeight = async () => {
    if (!weightForm.date || !weightForm.weight) return;
    try {
      await addDoc(collection(db, 'weights'), {
        date: weightForm.date,
        weight: parseFloat(weightForm.weight),
        notes: weightForm.notes,
        userEmail: user.email,
        createdAt: new Date().toISOString()
      });
      setShowAddWeight(false);
      setWeightForm({ date: '', weight: '', notes: '' });
      loadUserData(user.email);
    } catch (error) {
      console.error('Erro ao adicionar peso:', error);
      alert('Erro ao adicionar peso');
    }
  };

  const getWeightLoss = () => {
    if (weights.length < 2) return null;
    const sorted = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
    const initial = sorted[0].weight;
    const current = sorted[sorted.length - 1].weight;
    const loss = initial - current;
    return { initial, current, loss: loss.toFixed(1) };
  };

  const weightLoss = getWeightLoss();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingDown className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">TirzTrack</h1>
          <p className="text-gray-600 mb-8">Seu aliado no controle de peso com Tirzepatida</p>
          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            <User className="w-5 h-5" />
            Entrar com Google
          </button>
          <p className="text-xs text-gray-500 mt-4">
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">TirzTrack</h1>
          </div>
          <div className="flex items-center gap-3">
            <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {weightLoss && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Peso Inicial</p>
              <p className="text-3xl font-bold text-gray-800">{weightLoss.initial} kg</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Peso Atual</p>
              <p className="text-3xl font-bold text-gray-800">{weightLoss.current} kg</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 shadow-sm">
              <p className="text-white text-sm mb-1">Peso Perdido</p>
              <p className="text-3xl font-bold text-white">{weightLoss.loss} kg</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm mb-6 p-2 flex gap-2">
          <button
            onClick={() => setActiveTab('doses')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'doses' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Droplet className="w-5 h-5 inline mr-2" />
            Doses
          </button>
          <button
            onClick={() => setActiveTab('weights')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'weights' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-5 h-5 inline mr-2" />
            Peso
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'ranking' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Award className="w-5 h-5 inline mr-2" />
            Ranking
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'doses' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Minhas Doses</h2>
                <button
                  onClick={() => setShowAddDose(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar
                </button>
              </div>

              {showAddDose && (
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Nova Dose</h3>
                  <div className="space-y-4">
                    <input
                      type="date"
                      value={doseForm.date}
                      onChange={(e) => setDoseForm({...doseForm, date: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Dosagem (ex: 2.5mg)"
                      value={doseForm.dosage}
                      onChange={(e) => setDoseForm({...doseForm, dosage: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="time"
                      value={doseForm.time}
                      onChange={(e) => setDoseForm({...doseForm, time: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <textarea
                      placeholder="Observações (opcional)"
                      value={doseForm.notes}
                      onChange={(e) => setDoseForm({...doseForm, notes: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      rows="2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addDose}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setShowAddDose(false);
                          setDoseForm({ date: '', dosage: '', time: '', notes: '' });
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {doses.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhuma dose registrada ainda</p>
                ) : (
                  doses.map(dose => (
                    <div key={dose.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition">
                      <p className="font-semibold text-gray-800">{dose.dosage}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(dose.date).toLocaleDateString('pt-BR')}
                        {dose.time && ` • ${dose.time}`}
                      </p>
                      {dose.notes && <p className="text-sm text-gray-500 mt-1">{dose.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'weights' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Histórico de Peso</h2>
                <button
                  onClick={() => setShowAddWeight(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar
                </button>
              </div>

              {showAddWeight && (
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Novo Registro de Peso</h3>
                  <div className="space-y-4">
                    <input
                      type="date"
                      value={weightForm.date}
                      onChange={(e) => setWeightForm({...weightForm, date: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Peso (kg)"
                      value={weightForm.weight}
                      onChange={(e) => setWeightForm({...weightForm, weight: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <textarea
                      placeholder="Observações (opcional)"
                      value={weightForm.notes}
                      onChange={(e) => setWeightForm({...weightForm, notes: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      rows="2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addWeight}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setShowAddWeight(false);
                          setWeightForm({ date: '', weight: '', notes: '' });
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {weights.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum peso registrado ainda</p>
                ) : (
                  weights.map((weight, index) => {
                    const prev = weights[index + 1];
                    const diff = prev ? (weight.weight - prev.weight).toFixed(1) : null;
                    return (
                      <div key={weight.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-800 text-xl">{weight.weight} kg</p>
                            <p className="text-sm text-gray-600">{new Date(weight.date).toLocaleDateString('pt-BR')}</p>
                            {weight.notes && <p className="text-sm text-gray-500 mt-1">{weight.notes}</p>}
                          </div>
                          {diff && (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              parseFloat(diff) < 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {diff > 0 ? '+' : ''}{diff} kg
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'ranking' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Ranking de Perda de Peso</h2>
              <div className="space-y-3">
                {ranking.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Dados insuficientes para gerar ranking</p>
                ) : (
                  ranking.map((item, index) => (
                    <div
                      key={item.email}
                      className={`rounded-xl p-6 ${
                        index === 0
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                          : index === 1
                          ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800'
                          : index === 2
                          ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                            index < 3 ? 'bg-white bg-opacity-30' : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{item.email}</p>
                            <p className={`text-sm ${index < 3 ? 'opacity-90' : 'text-gray-600'}`}>
                              {item.initial}kg → {item.current}kg
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-2xl">-{item.loss} kg</p>
                          <p className={`text-sm ${index < 3 ? 'opacity-90' : 'text-gray-600'}`}>{item.percentage}%</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
