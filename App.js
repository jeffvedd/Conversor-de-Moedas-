import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

// 👇 IMPORTS DO ADMOB
import mobileAds from 'react-native-google-mobile-ads';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// Configuração de IDs (dev → teste / prod → seu ID)
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-5461017538385057/1372431612';

// Componente de moeda personalizado
const CurrencyItem = ({ currency, onPress, selected }) => (
  <TouchableOpacity 
    style={[styles.currencyItem, selected && styles.selectedCurrency]} 
    onPress={() => onPress(currency)}
  >
    <Text style={styles.currencyCode}>{currency.code}</Text>
    <Text style={styles.currencyName}>{currency.name}</Text>
  </TouchableOpacity>
);

// Componente de histórico
const HistoryItem = ({ item }) => (
  <View style={styles.historyItem}>
    <Text style={styles.historyText}>
      {item.amount} {item.from} = {item.result} {item.to}
    </Text>
    <Text style={styles.historyDate}>{item.date}</Text>
  </View>
);

export default function App() {
  const [currencies, setCurrencies] = useState([]);
  const [fromCurrency, setFromCurrency] = useState({ code: 'USD', name: 'Dólar Americano' });
  const [toCurrency, setToCurrency] = useState({ code: 'BRL', name: 'Real Brasileiro' });
  const [amount, setAmount] = useState('1');
  const [result, setResult] = useState('');
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [bannerError, setBannerError] = useState(false);

  // 👇 Inicializa o SDK do AdMob
  useEffect(() => {
    const initAdMob = async () => {
      try {
        await mobileAds().setRequestConfiguration({
          testDeviceIdentifiers: ['EMULATOR'],
        });
        await mobileAds().initialize();
        console.log('✅ AdMob inicializado no Conversor de Moedas!');
      } catch (error) {
        console.error('❌ Erro na inicialização do AdMob:', error);
      }
    };

    initAdMob();
  }, []);

  // Lista completa de moedas com nomes
  const currencyList = {
    USD: 'Dólar Americano',
    EUR: 'Euro',
    BRL: 'Real Brasileiro',
    JPY: 'Iene Japonês',
    GBP: 'Libra Esterlina',
    AUD: 'Dólar Australiano',
    CAD: 'Dólar Canadense',
    CHF: 'Franco Suíço',
    CNY: 'Yuan Chinês',
    INR: 'Rúpia Indiana',
    MXN: 'Peso Mexicano',
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    ADA: 'Cardano',
    DOGE: 'Dogecoin',
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  // Carregar dados iniciais (taxas e histórico)
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Carregar taxas de câmbio
      await loadCurrencies();
      
      // Carregar histórico
      await loadHistory();
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      Alert.alert('Erro', 'Falha ao carregar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar taxas de câmbio
  const loadCurrencies = async () => {
    try {
      // ✅ Corrigido: removido espaço no final da URL
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      setRates(response.data.rates);
      setLastUpdated(new Date().toLocaleString('pt-BR'));
      
      // Formatar moedas com nomes
      const formattedCurrencies = Object.keys(response.data.rates).map(code => ({
        code,
        name: currencyList[code] || code
      }));
      setCurrencies(formattedCurrencies);
      
      return true;
    } catch (error) {
      console.error('Erro ao carregar taxas:', error);
      throw error;
    }
  };

  // Carregar histórico do AsyncStorage
  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('conversionHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  // Salvar histórico no AsyncStorage
  const saveHistory = async (newHistory) => {
    try {
      await AsyncStorage.setItem('conversionHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  // Converter moedas
  const convert = () => {
    if (!amount || isNaN(amount) || amount <= 0) {
      setResult('0.00');
      return;
    }
    
    const fromRate = rates[fromCurrency.code];
    const toRate = rates[toCurrency.code];
    
    if (!fromRate || !toRate) {
      setResult('Erro');
      return;
    }
    
    const amountInUSD = parseFloat(amount) / fromRate;
    const converted = (amountInUSD * toRate).toFixed(2);
    setResult(converted);
  };

  // Atualizar conversão quando os valores mudarem
  useEffect(() => {
    if (Object.keys(rates).length > 0) {
      convert();
    }
  }, [amount, fromCurrency, toCurrency, rates]);

  // Função de refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCurrencies();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar taxas de câmbio.');
    } finally {
      setRefreshing(false);
    }
  };

  // Adicionar ao histórico
  const addToHistory = () => {
    if (!amount || isNaN(amount) || amount <= 0 || !result) return;
    
    const newEntry = {
      id: Date.now().toString(),
      amount,
      from: fromCurrency.code,
      to: toCurrency.code,
      result: result,
      date: new Date().toLocaleDateString('pt-BR')
    };
    
    const newHistory = [newEntry, ...history.slice(0, 9)]; // Manter apenas 10 itens
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  // Quando o resultado muda, adiciona ao histórico
  useEffect(() => {
    if (result && !isNaN(result) && result !== '0.00') {
      addToHistory();
    }
  }, [result]);

  // Selecionar moeda
  const selectCurrency = (currency, isFrom = true) => {
    if (isFrom) {
      setFromCurrency(currency);
    } else {
      setToCurrency(currency);
    }
    setShowFromPicker(false);
    setShowToPicker(false);
  };

  // Limpar histórico
  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('conversionHistory');
  };

  // Renderizar picker de moedas
  const renderCurrencyPicker = (isFrom = true) => {
    const selectedCurrency = isFrom ? fromCurrency : toCurrency;
    return (
      <Modal
        visible={isFrom ? showFromPicker : showToPicker}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione uma Moeda</Text>
              <TouchableOpacity 
                onPress={() => isFrom ? setShowFromPicker(false) : setShowToPicker(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <CurrencyItem
                  currency={item}
                  onPress={() => selectCurrency(item, isFrom)}
                  selected={item.code === selectedCurrency.code}
                />
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // Renderizar conteúdo principal
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4e73df" />
          <Text style={styles.loadingText}>Carregando taxas de câmbio...</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <ScrollView 
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 70 }} // 👈 espaço pro banner
        >
          {/* Cabeçalho */}
          <View style={styles.header}>
            <Text style={styles.title}>Conversor de Moedas</Text>
            <Text style={styles.subtitle}>Taxas atualizadas em: {lastUpdated}</Text>
          </View>
          
          {/* Conversor */}
          <View style={styles.converterContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Valor</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite o valor"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            
            <View style={styles.currencySelectors}>
              <TouchableOpacity 
                style={styles.currencySelector} 
                onPress={() => setShowFromPicker(true)}
              >
                <Text style={styles.currencyCode}>{fromCurrency.code}</Text>
                <Text style={styles.currencyName}>{fromCurrency.name}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.swapButton} 
                onPress={() => {
                  setFromCurrency(toCurrency);
                  setToCurrency(fromCurrency);
                }}
              >
                <Ionicons name="swap-horizontal" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.currencySelector} 
                onPress={() => setShowToPicker(true)}
              >
                <Text style={styles.currencyCode}>{toCurrency.code}</Text>
                <Text style={styles.currencyName}>{toCurrency.name}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>Resultado</Text>
              <Text style={styles.resultValue}>
                {amount || '0'} {fromCurrency.code} = {result || '0.00'} {toCurrency.code}
              </Text>
            </View>
          </View>
          
          {/* Histórico */}
          <View style={styles.historyContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Histórico de Conversões</Text>
              {history.length > 0 && (
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={styles.clearHistory}>Limpar</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {history.length === 0 ? (
              <Text style={styles.emptyHistory}>Nenhuma conversão realizada</Text>
            ) : (
              <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <HistoryItem item={item} />}
                scrollEnabled={false}
              />
            )}
          </View>
          
          {/* Pickers de moedas */}
          {renderCurrencyPicker(true)}
          {renderCurrencyPicker(false)}
        </ScrollView>

        {/* 👇 BANNER NO RODAPÉ */}
        <View style={styles.bannerContainer}>
          {bannerError ? (
            <View style={styles.bannerFallback}>
              <Ionicons name="alert-circle-outline" size={16} color="#e74a3b" />
              <Text style={styles.bannerErrorText}>Anúncio temporariamente indisponível</Text>
            </View>
          ) : (
            <BannerAd
              unitId={BANNER_AD_UNIT_ID}
              size={BannerAdSize.FULL_BANNER} // 320x50
              requestOptions={{ requestNonPersonalizedAdsOnly: false }}
              onAdLoaded={() => {
                console.log('✅ Banner carregado com sucesso!');
                setBannerError(false);
              }}
              onAdFailedToLoad={(error) => {
                console.warn('⚠️ Erro no banner:', error.message);
                setBannerError(true);
              }}
            />
          )}
        </View>
      </View>
    );
  };

  return renderContent();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  converterContainer: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    backgroundColor: '#f9f9f9',
  },
  currencySelectors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  currencySelector: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  currencyName: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  swapButton: {
    backgroundColor: '#4e73df',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 3,
  },
  resultContainer: {
    backgroundColor: '#e8f4ff',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4e73df',
  },
  historyContainer: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearHistory: {
    color: '#e74a3b',
    fontSize: 14,
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyText: {
    fontSize: 16,
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  currencyItem: {
    padding: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedCurrency: {
    backgroundColor: '#e8f4ff',
  },

  // 👇 Estilos do banner (harmonizados com seu tema azul)
  bannerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  bannerFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  bannerErrorText: {
    color: '#e74a3b',
    fontSize: 12,
    marginLeft: 6,
  },
});
