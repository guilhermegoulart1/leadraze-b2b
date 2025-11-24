// frontend/src/data/businessCategories.js
// Complete list of Google Maps business categories translated to PT-BR, EN, ES

export const BUSINESS_CATEGORIES = [
  // Financial Services
  { key: 'accounting', en: 'Accounting', pt: 'Contabilidade', es: 'Contabilidad' },
  { key: 'atm', en: 'ATM', pt: 'Caixa Eletrônico', es: 'Cajero Automático' },
  { key: 'bank', en: 'Bank', pt: 'Banco', es: 'Banco' },
  { key: 'insurance_agency', en: 'Insurance Agency', pt: 'Seguradora', es: 'Aseguradora' },

  // Food & Dining
  { key: 'bakery', en: 'Bakery', pt: 'Padaria', es: 'Panadería' },
  { key: 'bar', en: 'Bar', pt: 'Bar', es: 'Bar' },
  { key: 'cafe', en: 'Café', pt: 'Cafeteria', es: 'Cafetería' },
  { key: 'meal_delivery', en: 'Meal Delivery', pt: 'Entrega de Refeições', es: 'Entrega de Comida' },
  { key: 'meal_takeaway', en: 'Takeaway', pt: 'Comida para Viagem', es: 'Comida para Llevar' },
  { key: 'restaurant', en: 'Restaurant', pt: 'Restaurante', es: 'Restaurante' },

  // Health & Wellness
  { key: 'dentist', en: 'Dentist', pt: 'Dentista', es: 'Dentista' },
  { key: 'doctor', en: 'Doctor', pt: 'Médico', es: 'Médico' },
  { key: 'drugstore', en: 'Drugstore', pt: 'Farmácia', es: 'Farmacia' },
  { key: 'gym', en: 'Gym', pt: 'Academia', es: 'Gimnasio' },
  { key: 'hair_care', en: 'Hair Salon', pt: 'Cabeleireiro', es: 'Peluquería' },
  { key: 'hospital', en: 'Hospital', pt: 'Hospital', es: 'Hospital' },
  { key: 'pharmacy', en: 'Pharmacy', pt: 'Farmácia', es: 'Farmacia' },
  { key: 'physiotherapist', en: 'Physiotherapist', pt: 'Fisioterapeuta', es: 'Fisioterapeuta' },
  { key: 'spa', en: 'Spa', pt: 'Spa', es: 'Spa' },
  { key: 'beauty_salon', en: 'Beauty Salon', pt: 'Salão de Beleza', es: 'Salón de Belleza' },
  { key: 'veterinary_care', en: 'Veterinary', pt: 'Veterinário', es: 'Veterinario' },

  // Professional Services
  { key: 'lawyer', en: 'Lawyer', pt: 'Advogado', es: 'Abogado' },
  { key: 'electrician', en: 'Electrician', pt: 'Eletricista', es: 'Electricista' },
  { key: 'plumber', en: 'Plumber', pt: 'Encanador', es: 'Fontanero' },
  { key: 'locksmith', en: 'Locksmith', pt: 'Chaveiro', es: 'Cerrajero' },
  { key: 'painter', en: 'Painter', pt: 'Pintor', es: 'Pintor' },
  { key: 'roofing_contractor', en: 'Roofing Contractor', pt: 'Telhados', es: 'Techador' },
  { key: 'moving_company', en: 'Moving Company', pt: 'Mudanças', es: 'Empresa de Mudanzas' },
  { key: 'real_estate_agency', en: 'Real Estate Agency', pt: 'Imobiliária', es: 'Agencia Inmobiliaria' },
  { key: 'travel_agency', en: 'Travel Agency', pt: 'Agência de Viagens', es: 'Agencia de Viajes' },

  // Retail & Shopping
  { key: 'bicycle_store', en: 'Bicycle Store', pt: 'Loja de Bicicletas', es: 'Tienda de Bicicletas' },
  { key: 'book_store', en: 'Book Store', pt: 'Livraria', es: 'Librería' },
  { key: 'clothing_store', en: 'Clothing Store', pt: 'Loja de Roupas', es: 'Tienda de Ropa' },
  { key: 'convenience_store', en: 'Convenience Store', pt: 'Loja de Conveniência', es: 'Tienda de Conveniencia' },
  { key: 'department_store', en: 'Department Store', pt: 'Loja de Departamentos', es: 'Gran Almacén' },
  { key: 'electronics_store', en: 'Electronics Store', pt: 'Loja de Eletrônicos', es: 'Tienda de Electrónica' },
  { key: 'florist', en: 'Florist', pt: 'Floricultura', es: 'Floristería' },
  { key: 'furniture_store', en: 'Furniture Store', pt: 'Loja de Móveis', es: 'Mueblería' },
  { key: 'hardware_store', en: 'Hardware Store', pt: 'Loja de Ferramentas', es: 'Ferretería' },
  { key: 'home_goods_store', en: 'Home Goods Store', pt: 'Loja de Decoração', es: 'Tienda de Artículos para el Hogar' },
  { key: 'jewelry_store', en: 'Jewelry Store', pt: 'Joalheria', es: 'Joyería' },
  { key: 'pet_store', en: 'Pet Store', pt: 'Pet Shop', es: 'Tienda de Mascotas' },
  { key: 'shoe_store', en: 'Shoe Store', pt: 'Sapataria', es: 'Zapatería' },
  { key: 'shopping_mall', en: 'Shopping Mall', pt: 'Shopping Center', es: 'Centro Comercial' },
  { key: 'store', en: 'Store', pt: 'Loja', es: 'Tienda' },
  { key: 'supermarket', en: 'Supermarket', pt: 'Supermercado', es: 'Supermercado' },
  { key: 'liquor_store', en: 'Liquor Store', pt: 'Loja de Bebidas', es: 'Licorería' },

  // Automotive
  { key: 'car_dealer', en: 'Car Dealer', pt: 'Concessionária', es: 'Concesionario de Autos' },
  { key: 'car_rental', en: 'Car Rental', pt: 'Aluguel de Carros', es: 'Alquiler de Autos' },
  { key: 'car_repair', en: 'Car Repair', pt: 'Oficina Mecânica', es: 'Taller Mecánico' },
  { key: 'car_wash', en: 'Car Wash', pt: 'Lava-Rápido', es: 'Lavado de Autos' },
  { key: 'gas_station', en: 'Gas Station', pt: 'Posto de Gasolina', es: 'Gasolinera' },
  { key: 'parking', en: 'Parking', pt: 'Estacionamento', es: 'Estacionamiento' },

  // Education & Culture
  { key: 'library', en: 'Library', pt: 'Biblioteca', es: 'Biblioteca' },
  { key: 'museum', en: 'Museum', pt: 'Museu', es: 'Museo' },
  { key: 'primary_school', en: 'Primary School', pt: 'Escola Primária', es: 'Escuela Primaria' },
  { key: 'school', en: 'School', pt: 'Escola', es: 'Escuela' },
  { key: 'secondary_school', en: 'Secondary School', pt: 'Escola Secundária', es: 'Escuela Secundaria' },
  { key: 'university', en: 'University', pt: 'Universidade', es: 'Universidad' },
  { key: 'art_gallery', en: 'Art Gallery', pt: 'Galeria de Arte', es: 'Galería de Arte' },

  // Entertainment & Recreation
  { key: 'amusement_park', en: 'Amusement Park', pt: 'Parque de Diversões', es: 'Parque de Atracciones' },
  { key: 'aquarium', en: 'Aquarium', pt: 'Aquário', es: 'Acuario' },
  { key: 'bowling_alley', en: 'Bowling Alley', pt: 'Boliche', es: 'Bolera' },
  { key: 'campground', en: 'Campground', pt: 'Camping', es: 'Camping' },
  { key: 'casino', en: 'Casino', pt: 'Cassino', es: 'Casino' },
  { key: 'movie_rental', en: 'Movie Rental', pt: 'Locadora', es: 'Videoclub' },
  { key: 'movie_theater', en: 'Movie Theater', pt: 'Cinema', es: 'Cine' },
  { key: 'night_club', en: 'Night Club', pt: 'Boate', es: 'Discoteca' },
  { key: 'park', en: 'Park', pt: 'Parque', es: 'Parque' },
  { key: 'rv_park', en: 'RV Park', pt: 'Estacionamento de Trailers', es: 'Parque de Autocaravanas' },
  { key: 'stadium', en: 'Stadium', pt: 'Estádio', es: 'Estadio' },
  { key: 'tourist_attraction', en: 'Tourist Attraction', pt: 'Atração Turística', es: 'Atracción Turística' },
  { key: 'zoo', en: 'Zoo', pt: 'Zoológico', es: 'Zoológico' },

  // Lodging
  { key: 'lodging', en: 'Hotel', pt: 'Hotel', es: 'Hotel' },

  // Services
  { key: 'funeral_home', en: 'Funeral Home', pt: 'Funerária', es: 'Funeraria' },
  { key: 'laundry', en: 'Laundry', pt: 'Lavanderia', es: 'Lavandería' },
  { key: 'storage', en: 'Storage', pt: 'Armazenamento', es: 'Almacenamiento' },

  // Government & Public Services
  { key: 'city_hall', en: 'City Hall', pt: 'Prefeitura', es: 'Ayuntamiento' },
  { key: 'courthouse', en: 'Courthouse', pt: 'Tribunal', es: 'Juzgado' },
  { key: 'embassy', en: 'Embassy', pt: 'Embaixada', es: 'Embajada' },
  { key: 'fire_station', en: 'Fire Station', pt: 'Corpo de Bombeiros', es: 'Estación de Bomberos' },
  { key: 'local_government_office', en: 'Government Office', pt: 'Repartição Pública', es: 'Oficina Gubernamental' },
  { key: 'police', en: 'Police Station', pt: 'Delegacia', es: 'Comisaría' },
  { key: 'post_office', en: 'Post Office', pt: 'Correios', es: 'Oficina de Correos' },

  // Transportation
  { key: 'airport', en: 'Airport', pt: 'Aeroporto', es: 'Aeropuerto' },
  { key: 'bus_station', en: 'Bus Station', pt: 'Rodoviária', es: 'Estación de Autobuses' },
  { key: 'light_rail_station', en: 'Light Rail Station', pt: 'Estação de Trem', es: 'Estación de Tren Ligero' },
  { key: 'subway_station', en: 'Subway Station', pt: 'Estação de Metrô', es: 'Estación de Metro' },
  { key: 'taxi_stand', en: 'Taxi Stand', pt: 'Ponto de Táxi', es: 'Parada de Taxis' },
  { key: 'train_station', en: 'Train Station', pt: 'Estação Ferroviária', es: 'Estación de Tren' },
  { key: 'transit_station', en: 'Transit Station', pt: 'Estação de Transporte', es: 'Estación de Tránsito' },

  // Places of Worship
  { key: 'cemetery', en: 'Cemetery', pt: 'Cemitério', es: 'Cementerio' },
  { key: 'church', en: 'Church', pt: 'Igreja', es: 'Iglesia' },
  { key: 'hindu_temple', en: 'Hindu Temple', pt: 'Templo Hindu', es: 'Templo Hindú' },
  { key: 'mosque', en: 'Mosque', pt: 'Mesquita', es: 'Mezquita' },
  { key: 'synagogue', en: 'Synagogue', pt: 'Sinagoga', es: 'Sinagoga' },
];

/**
 * Get categories translated to user's language
 * @param {string} lang - Language code ('pt', 'en', 'es')
 * @returns {Array} Categories with translated labels
 */
export const getTranslatedCategories = (lang = 'en') => {
  return BUSINESS_CATEGORIES.map(cat => ({
    value: cat.key,
    label: cat[lang] || cat.en,
    en: cat.en,
    pt: cat.pt,
    es: cat.es
  }));
};

/**
 * Get category translation by key
 * @param {string} key - Category key (e.g., 'restaurant')
 * @param {string} lang - Language code ('pt', 'en', 'es')
 * @returns {string} Translated category name
 */
export const getCategoryTranslation = (key, lang = 'en') => {
  const category = BUSINESS_CATEGORIES.find(cat => cat.key === key);
  return category ? (category[lang] || category.en) : key;
};

/**
 * Detect user language from browser
 * @returns {string} Language code ('pt', 'en', 'es')
 */
export const detectUserLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;

  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('es')) return 'es';
  return 'en';
};
