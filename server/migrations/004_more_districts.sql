-- Add remaining Uganda coffee-producing districts.
-- ON CONFLICT DO NOTHING keeps this idempotent against the 8 already seeded.

INSERT INTO districts (name, code) VALUES
  -- Mt. Elgon / Eastern Arabica belt
  ('Bulambuli',        'BUL'),
  ('Sironko',          'SRK'),
  ('Manafwa',          'MNF'),
  ('Bududa',           'BDD'),
  ('Namisindwa',       'NMS'),

  -- Rwenzori Arabica belt
  ('Bundibugyo',       'BNB'),
  ('Ntoroko',          'NTR'),
  ('Kamwenge',         'KMW'),

  -- Western Robusta belt
  ('Sheema',           'SHM'),
  ('Mitooma',          'MTM'),
  ('Rubirizi',         'RBR'),
  ('Ntungamo',         'NTG'),
  ('Mbarara',          'MBR'),
  ('Ibanda',           'IBD'),
  ('Isingiro',         'ISG'),
  ('Kiruhura',         'KRH'),

  -- Greater Masaka Robusta
  ('Kalungu',          'KLN'),
  ('Bukomansimbi',     'BKM'),
  ('Kyotera',          'KYT'),
  ('Rakai',            'RKI'),
  ('Lwengo',           'LWN'),

  -- Lake Victoria crescent / Central Robusta
  ('Wakiso',           'WKS'),
  ('Mukono',           'MKN'),
  ('Kayunga',          'KYN'),
  ('Nakaseke',         'NKS'),
  ('Nakasongola',      'NKG'),

  -- Eastern Robusta
  ('Jinja',            'JNJ'),
  ('Iganga',           'IGN'),
  ('Bugiri',           'BGR'),
  ('Mayuge',           'MYG'),
  ('Namutumba',        'NMT'),
  ('Kamuli',           'KML'),
  ('Kaliro',           'KLR'),
  ('Buyende',          'BYD'),

  -- Mid-West Robusta
  ('Mityana',          'MTY'),
  ('Kiboga',           'KBG'),
  ('Kyankwanzi',       'KNZ'),
  ('Mubende',          'MBD'),
  ('Kassanda',         'KSD'),
  ('Gomba',            'GMB'),

  -- Greater North / West Nile (emerging)
  ('Hoima',            'HIM'),
  ('Kibaale',          'KBL'),
  ('Kagadi',           'KGD'),
  ('Kakumiro',         'KKM'),
  ('Masindi',          'MSD'),

  -- Trade / urban hubs
  ('Kampala',          'KMP'),
  ('Tororo',           'TRR'),
  ('Soroti',           'SRT')

ON CONFLICT (code) DO NOTHING;
