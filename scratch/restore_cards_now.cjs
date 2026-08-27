const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function getTasks(orderId) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?order_id=eq.${orderId}`;
    const req = https.get(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function insertWorkCard(cardData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(cardData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const cardsToRestore = [
  { id: '7d759bd4-e98b-4250-9ed5-359c785f2d88', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.14', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '5683e20c-c122-4967-b8a5-d6143f453996', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.23', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '2d0a1dd7-73dc-4740-b6a9-1c0e1f2d9d62', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.16', operator_name: 'Лапан Андрій', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '8be42257-7550-4975-99eb-d303bc318dd7', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.13', operator_name: 'Липко Дмитро', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '0fee988e-498f-458f-b75e-e9b4cfc8286d', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '16c54960-2871-457d-9478-d8a690d766a6', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '60bb2088-e0bf-48b5-a755-86424374696b', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.17', operator_name: 'Лапан Андрій', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '90c2381b-af3e-4d81-9e5b-150601e8e7a5', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '5f0fe56c-c69e-48cb-854f-fe74bf748d6c', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.5', operator_name: 'Половко Юрій', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '396295c6-7ce4-4431-bc2d-15dee58c368c', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.23', operator_name: 'Лапан Андрій', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'b1bccd88-84e6-4c0c-a995-a2e296bd2c0c', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.6', operator_name: 'Половко Юрій', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '41961c93-e09e-44c7-925a-da4671c5315f', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.25', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'b84fa74a-3b0c-4a4f-87fb-b22a68141866', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.11', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'b3966040-f796-4bd2-8502-7ea1fe8cb518', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.4', operator_name: 'Кравець Тарас', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '51012de5-ebd5-48d6-bb32-461182dca634', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.3', operator_name: 'Кравець Тарас', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'f747e775-6e80-492a-8415-353a5b23f05b', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.25', operator_name: 'Матейко Василь', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '25d1e85a-099f-4eea-8c72-4bb9ec40beec', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'b3b2afd8-acb8-4c49-be34-5b1731f2b621', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '1afa8279-3041-495b-b75f-f5d641395656', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '0d219827-33cf-485e-97d8-36150dbef7b3', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '2691ead1-8873-46c6-bf9f-ec2277a1f93d', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 117, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '74ccc9b7-af9c-4a21-9210-3367ca8893ec', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.27', operator_name: 'Матейко Василь', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '5feb05a4-fc43-42b3-88a7-dc927ebaa90f', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.26', operator_name: 'Матейко Василь', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'ab38c12f-39bc-44ee-a9c5-3d144b83163e', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.27', operator_name: 'Команда', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '49b6f7b0-ec9f-4396-af30-195c89f64251', nomenclature_id: '343417a7-4a5c-4e31-8f44-18abb41defec', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.25', operator_name: 'Команда', quantity: 156, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '97566fb1-726f-4698-8aa9-2587d5c09f43', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.10', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '064e04f8-f08f-41bc-b688-d458902879eb', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 6000x2000 - 4 - 96 листів (Дракон) №D1', operator_name: 'Садовий Дмитро', quantity: 224, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '9702a54d-8569-4d17-bf71-89721464bb96', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'new', machine: 'CNC 6000x2000 - 4 - 96 листів (Дракон)', operator_name: null, quantity: 224, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '6e9e47f0-0f78-44ae-bb45-d265c40d68a0', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 6000x2000 - 4 - 96 листів (Дракон) №D1', operator_name: 'Команда', quantity: 224, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd141d5dc-95fb-444e-a061-54399abc7685', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.27', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '6e8bae50-8da7-4578-a836-be2a6c99abe1', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.15', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd2f45a06-4901-49ab-8783-98fe64754428', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.11', operator_name: 'Команда', quantity: 48, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'f507b64c-ccb0-44be-bdf5-9a748aaf0992', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.15', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '12fbac40-2cf2-4304-9aca-129fd39c7f2a', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.21', operator_name: 'Янишівський Юрій', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '98b5d651-cb95-437e-8f6b-0596a260b194', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.3', operator_name: 'Команда', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '41c0e7be-ebd0-49e6-883e-3f771124c28b', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф2', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'fdcbc2b1-acf5-478a-9f63-963c24b1d093', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф3', operator_name: 'Партикевич Ярослав', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '59910c6d-442e-4d3a-b5e1-6c4dc7e05dcd', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'new', machine: 'CNC 1200x800 - 4 листи (Малий)', operator_name: null, quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '55de67d8-6efe-441c-950e-f5f2f03a496e', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф11', operator_name: 'Орихівський Олег', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '5ec3cff6-4827-4bd4-8dba-f6267e5492a3', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф6', operator_name: 'Мальчевський Володимир', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '5e0b4ef6-001a-4415-9dce-0532327b7b71', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф11', operator_name: 'Команда', quantity: 103, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd6926dfb-6c27-4684-b27f-2e27e93ac839', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф8', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '2e50a4da-b91b-4aa2-b5fc-f5dbf877beca', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф2', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'da99e086-4e2e-4a9b-ae47-55bfde7394f2', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф7', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'f986c065-4c42-40fc-a35a-583df56a9a07', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф7', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd41976ca-0962-4618-af6c-36bbed15d1e4', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф1', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'a532142f-0c09-45a5-b4b3-ebfa088e3176', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф6', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd4cb8e09-9ca7-4aff-a264-e4354cee4501', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.24', operator_name: 'Янишівський Юрій', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '2c658bd3-3f92-45bf-849e-601cc793d650', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.7', operator_name: 'Половко Юрій', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'a7f687b6-2352-4a4b-a138-f57545fe6536', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.22', operator_name: 'Янишівський Юрій', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '49ff1ba6-8c56-4b40-b46e-1c340e44771c', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.12', operator_name: 'Вайнапель Данило', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '01af2d98-6705-40a4-8d1a-aaeac7907648', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.9', operator_name: 'Вайнапель Данило', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '1be69d37-65c8-45ea-8f7e-35e5d3d186c8', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.22', operator_name: 'Команда', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '2902e3ae-1758-48af-84eb-d5ef354ada79', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.2', operator_name: 'Кравець Тарас', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'ad7e169c-c8e0-48c9-aa1d-0c7a666acb0f', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.1', operator_name: 'Кравець Тарас', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '0a14298c-5584-415e-8939-834473bfb17a', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.10', operator_name: 'Вайнапель Данило', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '5c0c1aea-8ce0-4319-a797-199b4f2fdd9a', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.11', operator_name: 'Вайнапель Данило', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd47195d5-50f4-4a86-a29c-40cc6e5ee7b2', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.13', operator_name: 'Команда', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'aab52822-3e85-402f-a1de-2c443bb44f6c', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.26', operator_name: 'Матейко Василь', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '73384086-3c7c-49be-9734-2e49e64618b7', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.8', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'fede8e33-4739-4fee-a598-07400c2762c7', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф10', operator_name: 'Орихівський Олег', quantity: 150, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '50122af7-af52-4574-9550-bbedb0ea079e', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.24', operator_name: 'Команда', quantity: 117, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '2c5592e7-e849-41b8-ae5b-9075392975a5', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф8', operator_name: 'Федаш Володимир', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '85521a82-585f-45c2-8001-61f1ddda2f59', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф15', operator_name: 'Когут Назар', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'd2a250c0-4d3b-4703-8ec7-d5777ec55554', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф10', operator_name: 'Команда', quantity: 238, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'f72a9191-dde4-4879-a92b-8cfc269e1bd9', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф5', operator_name: 'Мальчевський Володимир', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'f266de29-bb6a-4446-a322-4f43fc836472', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф4', operator_name: 'Партикевич Ярослав', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '53f76629-15ed-4541-ae0f-cbb5a5f2ac23', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф1', operator_name: 'Шак Мар\'ян', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '3c6e47be-58ab-4ce5-acd4-411d48f0320a', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф14', operator_name: 'Когут Назар', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '80154db9-cffb-4cd6-b195-043ad0626796', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф14', operator_name: 'Команда', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'fc000bea-42e1-49f4-8ba5-1e543855a112', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф5', operator_name: 'Команда', quantity: 240, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '724ee7e0-d089-4cff-92f3-a6f23740c3cf', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'in-progress', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф7', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '78610b3d-e1a6-45a8-bc66-cf371cb3e24a', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.21', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'eb2f078b-4208-40f9-81a0-29830a0583e2', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.16', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '05087ab5-b40a-496a-8374-e197e8f5b27f', nomenclature_id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.12', operator_name: 'Команда', quantity: 120, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '13c62756-bb0b-4ed5-8adc-7e81a07ac5a6', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.16', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '504af702-81d3-41dc-b54d-1049230d393d', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.14', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '419ecb04-476b-405c-9a6f-78654ae07462', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.21', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '12c2af12-716c-4440-b1cb-a93863de667c', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.10', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'caaefdaf-58dc-40b3-847e-9bee4078255c', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.5', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'bb5269bd-0d93-4303-b42f-3b567811d161', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ) №Ф3', operator_name: 'Команда', quantity: 112, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: 'b83a5df9-9601-4d66-9470-a735620972af', nomenclature_id: 'e0face80-f00d-48cf-9fed-914995f86e71', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.14', operator_name: 'Липко Дмитро', quantity: 54, order_id: '50a32d8b-27ca-4037-956c-9bafc8e83e4a' },
  { id: 'd7e1a38b-57b4-4026-a4fa-31f2ae4fa179', nomenclature_id: '312b0260-707a-4dc4-9f7a-bd412dd8fa00', status: 'in-progress', machine: 'CNC 1200x800 - 4 листи (Малий) №1.15', operator_name: 'Липко Дмитро', quantity: 54, order_id: '50a32d8b-27ca-4037-956c-9bafc8e83e4a' },
  { id: '1b81d226-e403-4669-87c9-33b545f27f05', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.17', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' },
  { id: '6e780058-1eac-4a76-b665-f1f69c3fe941', nomenclature_id: '50947afc-4e40-4165-a682-780275d5feda', status: 'at-buffer', machine: 'CNC 1200x800 - 4 листи (Малий) №1.4', operator_name: 'Команда', quantity: 56, order_id: '6580533f-333b-453c-9f80-b8e8a088da7a' }
];

async function run() {
  const tasks260826 = await getTasks('6580533f-333b-453c-9f80-b8e8a088da7a');
  const tasks260827 = await getTasks('50a32d8b-27ca-4037-956c-9bafc8e83e4a');

  const taskMap = {};
  [...tasks260826, ...tasks260827].forEach(t => {
    taskMap[t.nomenclature_id] = t.id;
  });

  let restoredCount = 0;
  for (const c of cardsToRestore) {
    const taskId = taskMap[c.nomenclature_id] || (tasks260826[0] ? tasks260826[0].id : null);
    const payload = {
      id: c.id,
      task_id: taskId,
      order_id: c.order_id,
      nomenclature_id: c.nomenclature_id,
      operation: 'Розкрій',
      machine: c.machine,
      status: c.status,
      operator_name: c.operator_name,
      quantity: c.quantity,
      card_info: `#${c.id.substring(0, 8).toUpperCase()}`
    };

    const status = await insertWorkCard(payload);
    if (status === 200 || status === 201) restoredCount++;
  }

  console.log(`RESTORED ${restoredCount} WORK CARDS FOR ACTIVE ORDERS!`);
}

run();
