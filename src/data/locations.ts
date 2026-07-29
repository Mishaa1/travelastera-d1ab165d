/**
 * Local location gazetteer.
 *
 * A deliberately broad, offline dataset of cities and their major airports.
 * It is the fallback for `locationService` and guarantees the planner keeps
 * working when a remote lookup is unavailable, rate-limited or blocked.
 *
 * Tuple shape keeps the file small and easy to extend:
 *   [city, country, ISO-2, lat, lon, [[IATA, airport name], ...]]
 */

type CityTuple = [string, string, string, number, number, [string, string][]];

export const CITY_GAZETTEER: CityTuple[] = [
  // ---------------------------------------------------------------- France
  ["Paris", "France", "FR", 48.8566, 2.3522, [["CDG", "Charles de Gaulle Airport"], ["ORY", "Orly Airport"], ["BVA", "Beauvais–Tillé Airport"]]],
  ["Lyon", "France", "FR", 45.764, 4.8357, [["LYS", "Saint-Exupéry Airport"]]],
  ["Marseille", "France", "FR", 43.2965, 5.3698, [["MRS", "Marseille Provence Airport"]]],
  ["Nice", "France", "FR", 43.7102, 7.262, [["NCE", "Côte d'Azur Airport"]]],
  ["Toulouse", "France", "FR", 43.6047, 1.4442, [["TLS", "Toulouse–Blagnac Airport"]]],
  ["Bordeaux", "France", "FR", 44.8378, -0.5792, [["BOD", "Bordeaux–Mérignac Airport"]]],
  ["Nantes", "France", "FR", 47.2184, -1.5536, [["NTE", "Nantes Atlantique Airport"]]],
  ["Strasbourg", "France", "FR", 48.5734, 7.7521, [["SXB", "Strasbourg Airport"]]],
  ["Annecy", "France", "FR", 45.8992, 6.1294, []],
  ["Biarritz", "France", "FR", 43.4832, -1.5586, [["BIQ", "Biarritz Pays Basque Airport"]]],

  // -------------------------------------------------------- United Kingdom
  ["London", "United Kingdom", "GB", 51.5072, -0.1276, [["LHR", "Heathrow Airport"], ["LGW", "Gatwick Airport"], ["STN", "Stansted Airport"], ["LTN", "Luton Airport"], ["LCY", "London City Airport"]]],
  ["Manchester", "United Kingdom", "GB", 53.4808, -2.2426, [["MAN", "Manchester Airport"]]],
  ["Birmingham", "United Kingdom", "GB", 52.4862, -1.8904, [["BHX", "Birmingham Airport"]]],
  ["Edinburgh", "United Kingdom", "GB", 55.9533, -3.1883, [["EDI", "Edinburgh Airport"]]],
  ["Glasgow", "United Kingdom", "GB", 55.8642, -4.2518, [["GLA", "Glasgow Airport"]]],
  ["Bristol", "United Kingdom", "GB", 51.4545, -2.5879, [["BRS", "Bristol Airport"]]],
  ["Leeds", "United Kingdom", "GB", 53.8008, -1.5491, [["LBA", "Leeds Bradford Airport"]]],
  ["Liverpool", "United Kingdom", "GB", 53.4084, -2.9916, [["LPL", "John Lennon Airport"]]],
  ["Newcastle", "United Kingdom", "GB", 54.9783, -1.6178, [["NCL", "Newcastle Airport"]]],
  ["Belfast", "United Kingdom", "GB", 54.5973, -5.9301, [["BFS", "Belfast International Airport"]]],

  // --------------------------------------------------------------- Ireland
  ["Dublin", "Ireland", "IE", 53.3498, -6.2603, [["DUB", "Dublin Airport"]]],
  ["Cork", "Ireland", "IE", 51.8985, -8.4756, [["ORK", "Cork Airport"]]],
  ["Galway", "Ireland", "IE", 53.2707, -9.0568, []],
  ["Shannon", "Ireland", "IE", 52.7019, -8.8647, [["SNN", "Shannon Airport"]]],

  // --------------------------------------------------------------- Germany
  ["Berlin", "Germany", "DE", 52.52, 13.405, [["BER", "Brandenburg Airport"]]],
  ["Munich", "Germany", "DE", 48.1372, 11.5756, [["MUC", "Franz Josef Strauss Airport"]]],
  ["Frankfurt", "Germany", "DE", 50.1109, 8.6821, [["FRA", "Frankfurt Airport"], ["HHN", "Frankfurt–Hahn Airport"]]],
  ["Hamburg", "Germany", "DE", 53.5511, 9.9937, [["HAM", "Hamburg Airport"]]],
  ["Cologne", "Germany", "DE", 50.9375, 6.9603, [["CGN", "Cologne Bonn Airport"]]],
  ["Düsseldorf", "Germany", "DE", 51.2277, 6.7735, [["DUS", "Düsseldorf Airport"]]],
  ["Stuttgart", "Germany", "DE", 48.7758, 9.1829, [["STR", "Stuttgart Airport"]]],
  ["Dresden", "Germany", "DE", 51.0504, 13.7373, [["DRS", "Dresden Airport"]]],
  ["Nuremberg", "Germany", "DE", 49.4521, 11.0767, [["NUE", "Nuremberg Airport"]]],
  ["Leipzig", "Germany", "DE", 51.3397, 12.3731, [["LEJ", "Leipzig/Halle Airport"]]],

  // --------------------------------------------------------------- Austria
  ["Vienna", "Austria", "AT", 48.2082, 16.3738, [["VIE", "Schwechat Airport"]]],
  ["Salzburg", "Austria", "AT", 47.8095, 13.055, [["SZG", "W. A. Mozart Airport"]]],
  ["Innsbruck", "Austria", "AT", 47.2692, 11.4041, [["INN", "Innsbruck Airport"]]],
  ["Graz", "Austria", "AT", 47.0707, 15.4395, [["GRZ", "Graz Airport"]]],
  ["Hallstatt", "Austria", "AT", 47.5622, 13.6493, []],

  // ----------------------------------------------------------------- Italy
  ["Rome", "Italy", "IT", 41.9028, 12.4964, [["FCO", "Fiumicino Airport"], ["CIA", "Ciampino Airport"]]],
  ["Milan", "Italy", "IT", 45.4642, 9.19, [["MXP", "Malpensa Airport"], ["LIN", "Linate Airport"], ["BGY", "Bergamo Orio al Serio Airport"]]],
  ["Venice", "Italy", "IT", 45.4408, 12.3155, [["VCE", "Marco Polo Airport"], ["TSF", "Treviso Airport"]]],
  ["Florence", "Italy", "IT", 43.7696, 11.2558, [["FLR", "Peretola Airport"]]],
  ["Naples", "Italy", "IT", 40.8518, 14.2681, [["NAP", "Capodichino Airport"]]],
  ["Bologna", "Italy", "IT", 44.4949, 11.3426, [["BLQ", "Guglielmo Marconi Airport"]]],
  ["Turin", "Italy", "IT", 45.0703, 7.6869, [["TRN", "Turin Airport"]]],
  ["Palermo", "Italy", "IT", 38.1157, 13.3615, [["PMO", "Falcone Borsellino Airport"]]],
  ["Catania", "Italy", "IT", 37.5079, 15.083, [["CTA", "Fontanarossa Airport"]]],
  ["Bari", "Italy", "IT", 41.1171, 16.8719, [["BRI", "Karol Wojtyła Airport"]]],
  ["Verona", "Italy", "IT", 45.4384, 10.9916, [["VRN", "Villafranca Airport"]]],

  // ----------------------------------------------------------------- Spain
  ["Madrid", "Spain", "ES", 40.4168, -3.7038, [["MAD", "Barajas Airport"]]],
  ["Barcelona", "Spain", "ES", 41.3874, 2.1686, [["BCN", "El Prat Airport"], ["GRO", "Girona–Costa Brava Airport"]]],
  ["Seville", "Spain", "ES", 37.3891, -5.9845, [["SVQ", "Sevilla Airport"]]],
  ["Valencia", "Spain", "ES", 39.4699, -0.3763, [["VLC", "Valencia Airport"]]],
  ["Málaga", "Spain", "ES", 36.7213, -4.4214, [["AGP", "Costa del Sol Airport"]]],
  ["Bilbao", "Spain", "ES", 43.263, -2.935, [["BIO", "Bilbao Airport"]]],
  ["Granada", "Spain", "ES", 37.1773, -3.5986, [["GRX", "Federico García Lorca Airport"]]],
  ["Palma de Mallorca", "Spain", "ES", 39.5696, 2.6502, [["PMI", "Palma de Mallorca Airport"]]],
  ["Alicante", "Spain", "ES", 38.3452, -0.4815, [["ALC", "Alicante–Elche Airport"]]],
  ["San Sebastián", "Spain", "ES", 43.3183, -1.9812, [["EAS", "San Sebastián Airport"]]],
  ["Ibiza", "Spain", "ES", 38.9067, 1.4206, [["IBZ", "Ibiza Airport"]]],
  ["Las Palmas", "Spain", "ES", 28.1235, -15.4363, [["LPA", "Gran Canaria Airport"]]],

  // -------------------------------------------------------------- Portugal
  ["Lisbon", "Portugal", "PT", 38.7223, -9.1393, [["LIS", "Humberto Delgado Airport"]]],
  ["Porto", "Portugal", "PT", 41.1579, -8.6291, [["OPO", "Francisco Sá Carneiro Airport"]]],
  ["Faro", "Portugal", "PT", 37.0194, -7.9304, [["FAO", "Faro Airport"]]],
  ["Funchal", "Portugal", "PT", 32.6669, -16.9241, [["FNC", "Madeira Airport"]]],
  ["Coimbra", "Portugal", "PT", 40.2033, -8.4103, []],

  // ----------------------------------------------------------- Netherlands
  ["Amsterdam", "Netherlands", "NL", 52.3676, 4.9041, [["AMS", "Schiphol Airport"]]],
  ["Rotterdam", "Netherlands", "NL", 51.9244, 4.4777, [["RTM", "Rotterdam The Hague Airport"]]],
  ["Eindhoven", "Netherlands", "NL", 51.4416, 5.4697, [["EIN", "Eindhoven Airport"]]],
  ["Utrecht", "Netherlands", "NL", 52.0907, 5.1214, []],

  // --------------------------------------------------------------- Belgium
  ["Brussels", "Belgium", "BE", 50.8476, 4.3572, [["BRU", "Zaventem Airport"], ["CRL", "Brussels South Charleroi Airport"]]],
  ["Bruges", "Belgium", "BE", 51.2093, 3.2247, []],
  ["Antwerp", "Belgium", "BE", 51.2194, 4.4025, [["ANR", "Antwerp International Airport"]]],
  ["Ghent", "Belgium", "BE", 51.0543, 3.7174, []],

  // ----------------------------------------------------------- Switzerland
  ["Zurich", "Switzerland", "CH", 47.3769, 8.5417, [["ZRH", "Zurich Airport"]]],
  ["Geneva", "Switzerland", "CH", 46.2044, 6.1432, [["GVA", "Geneva Airport"]]],
  ["Bern", "Switzerland", "CH", 46.948, 7.4474, [["BRN", "Bern Airport"]]],
  ["Basel", "Switzerland", "CH", 47.5596, 7.5886, [["BSL", "EuroAirport Basel–Mulhouse"]]],
  ["Lucerne", "Switzerland", "CH", 47.0502, 8.3093, []],
  ["Interlaken", "Switzerland", "CH", 46.6863, 7.8632, []],
  ["Zermatt", "Switzerland", "CH", 46.0207, 7.7491, []],

  // ---------------------------------------------------------------- Greece
  ["Athens", "Greece", "GR", 37.9838, 23.7275, [["ATH", "Eleftherios Venizelos Airport"]]],
  ["Thessaloniki", "Greece", "GR", 40.6401, 22.9444, [["SKG", "Makedonia Airport"]]],
  ["Santorini", "Greece", "GR", 36.3932, 25.4615, [["JTR", "Santorini Airport"]]],
  ["Mykonos", "Greece", "GR", 37.4467, 25.3289, [["JMK", "Mykonos Airport"]]],
  ["Crete", "Greece", "GR", 35.3387, 25.1442, [["HER", "Heraklion Airport"], ["CHQ", "Chania Airport"]]],
  ["Rhodes", "Greece", "GR", 36.4341, 28.2176, [["RHO", "Rhodes Airport"]]],
  ["Corfu", "Greece", "GR", 39.6243, 19.9217, [["CFU", "Corfu Airport"]]],
  ["Naxos", "Greece", "GR", 37.1036, 25.3766, [["JNX", "Naxos Island Airport"]]],

  // ---------------------------------------------------------------- Turkey
  ["Istanbul", "Turkey", "TR", 41.0082, 28.9784, [["IST", "Istanbul Airport"], ["SAW", "Sabiha Gökçen Airport"]]],
  ["Antalya", "Turkey", "TR", 36.8969, 30.7133, [["AYT", "Antalya Airport"]]],
  ["Izmir", "Turkey", "TR", 38.4237, 27.1428, [["ADB", "Adnan Menderes Airport"]]],
  ["Ankara", "Turkey", "TR", 39.9334, 32.8597, [["ESB", "Esenboğa Airport"]]],
  ["Cappadocia", "Turkey", "TR", 38.6431, 34.8289, [["NAV", "Nevşehir Kapadokya Airport"]]],
  ["Bodrum", "Turkey", "TR", 37.0344, 27.4305, [["BJV", "Milas–Bodrum Airport"]]],

  // ---------------------------------------------------------------- Poland
  ["Warsaw", "Poland", "PL", 52.2297, 21.0122, [["WAW", "Chopin Airport"], ["WMI", "Modlin Airport"]]],
  ["Kraków", "Poland", "PL", 50.0647, 19.945, [["KRK", "John Paul II Airport"]]],
  ["Gdańsk", "Poland", "PL", 54.352, 18.6466, [["GDN", "Lech Wałęsa Airport"]]],
  ["Wrocław", "Poland", "PL", 51.1079, 17.0385, [["WRO", "Copernicus Airport"]]],
  ["Poznań", "Poland", "PL", 52.4064, 16.9252, [["POZ", "Ławica Airport"]]],

  // --------------------------------------------------------------- Czechia
  ["Prague", "Czechia", "CZ", 50.0755, 14.4378, [["PRG", "Václav Havel Airport"]]],
  ["Brno", "Czechia", "CZ", 49.1951, 16.6068, [["BRQ", "Brno–Tuřany Airport"]]],
  ["Český Krumlov", "Czechia", "CZ", 48.8127, 14.3175, []],

  // --------------------------------------------------------------- Hungary
  ["Budapest", "Hungary", "HU", 47.4979, 19.0402, [["BUD", "Ferenc Liszt Airport"]]],
  ["Debrecen", "Hungary", "HU", 47.5316, 21.6273, [["DEB", "Debrecen Airport"]]],
  ["Lake Balaton", "Hungary", "HU", 46.8333, 17.7333, []],

  // --------------------------------------------------------------- Croatia
  ["Zagreb", "Croatia", "HR", 45.815, 15.9819, [["ZAG", "Franjo Tuđman Airport"]]],
  ["Split", "Croatia", "HR", 43.5081, 16.4402, [["SPU", "Split Airport"]]],
  ["Dubrovnik", "Croatia", "HR", 42.6507, 18.0944, [["DBV", "Dubrovnik Airport"]]],
  ["Zadar", "Croatia", "HR", 44.1194, 15.2314, [["ZAD", "Zadar Airport"]]],
  ["Pula", "Croatia", "HR", 44.8666, 13.8496, [["PUY", "Pula Airport"]]],
  ["Hvar", "Croatia", "HR", 43.1729, 16.4411, []],

  // --------------------------------------------------------------- Denmark
  ["Copenhagen", "Denmark", "DK", 55.6761, 12.5683, [["CPH", "Kastrup Airport"]]],
  ["Aarhus", "Denmark", "DK", 56.1629, 10.2039, [["AAR", "Aarhus Airport"]]],
  ["Billund", "Denmark", "DK", 55.7308, 9.116, [["BLL", "Billund Airport"]]],

  // ---------------------------------------------------------------- Sweden
  ["Stockholm", "Sweden", "SE", 59.3293, 18.0686, [["ARN", "Arlanda Airport"], ["BMA", "Bromma Airport"]]],
  ["Gothenburg", "Sweden", "SE", 57.7089, 11.9746, [["GOT", "Landvetter Airport"]]],
  ["Malmö", "Sweden", "SE", 55.605, 13.0038, [["MMX", "Malmö Airport"]]],
  ["Kiruna", "Sweden", "SE", 67.8558, 20.2253, [["KRN", "Kiruna Airport"]]],

  // ---------------------------------------------------------------- Norway
  ["Oslo", "Norway", "NO", 59.9139, 10.7522, [["OSL", "Gardermoen Airport"], ["TRF", "Sandefjord Torp Airport"]]],
  ["Bergen", "Norway", "NO", 60.3913, 5.3221, [["BGO", "Flesland Airport"]]],
  ["Tromsø", "Norway", "NO", 69.6492, 18.9553, [["TOS", "Tromsø Airport"]]],
  ["Trondheim", "Norway", "NO", 63.4305, 10.3951, [["TRD", "Værnes Airport"]]],
  ["Stavanger", "Norway", "NO", 58.97, 5.7331, [["SVG", "Sola Airport"]]],

  // --------------------------------------------------------------- Finland
  ["Helsinki", "Finland", "FI", 60.1699, 24.9384, [["HEL", "Helsinki-Vantaa Airport"]]],
  ["Rovaniemi", "Finland", "FI", 66.5039, 25.7294, [["RVN", "Rovaniemi Airport"]]],
  ["Tampere", "Finland", "FI", 61.4978, 23.761, [["TMP", "Tampere–Pirkkala Airport"]]],
  ["Turku", "Finland", "FI", 60.4518, 22.2666, [["TKU", "Turku Airport"]]],

  // ---------------------------------------------------------- Rest of EU-ish
  ["Ljubljana", "Slovenia", "SI", 46.0569, 14.5058, [["LJU", "Jože Pučnik Airport"]]],
  ["Lake Bled", "Slovenia", "SI", 46.3683, 14.1146, []],
  ["Kotor", "Montenegro", "ME", 42.4247, 18.7712, [["TIV", "Tivat Airport"]]],
  ["Tallinn", "Estonia", "EE", 59.437, 24.7536, [["TLL", "Lennart Meri Airport"]]],
  ["Riga", "Latvia", "LV", 56.9496, 24.1052, [["RIX", "Riga Airport"]]],
  ["Vilnius", "Lithuania", "LT", 54.6872, 25.2797, [["VNO", "Vilnius Airport"]]],
  ["Reykjavík", "Iceland", "IS", 64.1466, -21.9426, [["KEF", "Keflavík Airport"]]],
  ["Bucharest", "Romania", "RO", 44.4268, 26.1025, [["OTP", "Henri Coandă Airport"]]],
  ["Sofia", "Bulgaria", "BG", 42.6977, 23.3219, [["SOF", "Sofia Airport"]]],
  ["Valletta", "Malta", "MT", 35.8989, 14.5146, [["MLA", "Malta International Airport"]]],
  ["Luxembourg", "Luxembourg", "LU", 49.6116, 6.1319, [["LUX", "Luxembourg Airport"]]],

  // -------------------------------------------------------------- Pakistan
  ["Karachi", "Pakistan", "PK", 24.8607, 67.0011, [["KHI", "Jinnah International Airport"]]],
  ["Lahore", "Pakistan", "PK", 31.5204, 74.3587, [["LHE", "Allama Iqbal International Airport"]]],
  ["Islamabad", "Pakistan", "PK", 33.6844, 73.0479, [["ISB", "Islamabad International Airport"]]],
  ["Peshawar", "Pakistan", "PK", 34.0151, 71.5249, [["PEW", "Bacha Khan International Airport"]]],
  ["Multan", "Pakistan", "PK", 30.1575, 71.5249, [["MUX", "Multan International Airport"]]],
  ["Faisalabad", "Pakistan", "PK", 31.4187, 73.0791, [["LYP", "Faisalabad International Airport"]]],
  ["Quetta", "Pakistan", "PK", 30.1798, 66.975, [["UET", "Quetta International Airport"]]],
  ["Sialkot", "Pakistan", "PK", 32.4945, 74.5229, [["SKT", "Sialkot International Airport"]]],
  ["Skardu", "Pakistan", "PK", 35.2971, 75.6333, [["KDU", "Skardu Airport"]]],
  ["Gilgit", "Pakistan", "PK", 35.9208, 74.3144, [["GIL", "Gilgit Airport"]]],

  // ----------------------------------------------------------------- India
  ["Delhi", "India", "IN", 28.6139, 77.209, [["DEL", "Indira Gandhi International Airport"]]],
  ["Mumbai", "India", "IN", 19.076, 72.8777, [["BOM", "Chhatrapati Shivaji Airport"]]],
  ["Bengaluru", "India", "IN", 12.9716, 77.5946, [["BLR", "Kempegowda International Airport"]]],
  ["Chennai", "India", "IN", 13.0827, 80.2707, [["MAA", "Chennai International Airport"]]],
  ["Hyderabad", "India", "IN", 17.385, 78.4867, [["HYD", "Rajiv Gandhi International Airport"]]],
  ["Kolkata", "India", "IN", 22.5726, 88.3639, [["CCU", "Netaji Subhas Chandra Bose Airport"]]],
  ["Goa", "India", "IN", 15.2993, 74.124, [["GOI", "Dabolim Airport"], ["GOX", "Manohar International Airport"]]],
  ["Jaipur", "India", "IN", 26.9124, 75.7873, [["JAI", "Jaipur International Airport"]]],
  ["Kochi", "India", "IN", 9.9312, 76.2673, [["COK", "Cochin International Airport"]]],
  ["Amritsar", "India", "IN", 31.634, 74.8723, [["ATQ", "Sri Guru Ram Dass Jee Airport"]]],

  // --------------------------------------------------- United Arab Emirates
  ["Dubai", "United Arab Emirates", "AE", 25.2048, 55.2708, [["DXB", "Dubai International Airport"], ["DWC", "Al Maktoum International Airport"]]],
  ["Abu Dhabi", "United Arab Emirates", "AE", 24.4539, 54.3773, [["AUH", "Zayed International Airport"]]],
  ["Sharjah", "United Arab Emirates", "AE", 25.3463, 55.4209, [["SHJ", "Sharjah International Airport"]]],
  ["Ras Al Khaimah", "United Arab Emirates", "AE", 25.8007, 55.9762, [["RKT", "Ras Al Khaimah Airport"]]],

  // ---------------------------------------------------------------- Canada
  ["Toronto", "Canada", "CA", 43.6532, -79.3832, [["YYZ", "Pearson International Airport"], ["YTZ", "Billy Bishop Airport"]]],
  ["Montréal", "Canada", "CA", 45.5019, -73.5674, [["YUL", "Montréal–Trudeau Airport"]]],
  ["Vancouver", "Canada", "CA", 49.2827, -123.1207, [["YVR", "Vancouver International Airport"]]],
  ["Calgary", "Canada", "CA", 51.0447, -114.0719, [["YYC", "Calgary International Airport"]]],
  ["Ottawa", "Canada", "CA", 45.4215, -75.6972, [["YOW", "Ottawa Macdonald–Cartier Airport"]]],
  ["Halifax", "Canada", "CA", 44.6488, -63.5752, [["YHZ", "Halifax Stanfield Airport"]]],

  // --------------------------------------------------------- United States
  ["New York", "United States", "US", 40.7128, -74.006, [["JFK", "John F. Kennedy International Airport"], ["EWR", "Newark Liberty Airport"], ["LGA", "LaGuardia Airport"]]],
  ["Los Angeles", "United States", "US", 34.0522, -118.2437, [["LAX", "Los Angeles International Airport"]]],
  ["Chicago", "United States", "US", 41.8781, -87.6298, [["ORD", "O'Hare International Airport"], ["MDW", "Midway Airport"]]],
  ["Boston", "United States", "US", 42.3601, -71.0589, [["BOS", "Logan International Airport"]]],
  ["San Francisco", "United States", "US", 37.7749, -122.4194, [["SFO", "San Francisco International Airport"]]],
  ["Miami", "United States", "US", 25.7617, -80.1918, [["MIA", "Miami International Airport"]]],
  ["Washington", "United States", "US", 38.9072, -77.0369, [["IAD", "Dulles International Airport"], ["DCA", "Reagan National Airport"]]],
  ["Seattle", "United States", "US", 47.6062, -122.3321, [["SEA", "Seattle–Tacoma Airport"]]],
  ["Dallas", "United States", "US", 32.7767, -96.797, [["DFW", "Dallas/Fort Worth Airport"]]],
  ["Atlanta", "United States", "US", 33.749, -84.388, [["ATL", "Hartsfield–Jackson Airport"]]],
];

export const COUNTRY_BY_CODE: Record<string, string> = CITY_GAZETTEER.reduce(
  (acc, [, country, code]) => {
    acc[code] = country;
    return acc;
  },
  {} as Record<string, string>,
);
