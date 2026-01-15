
async function testSokkerPro() {
  const url = 'https://m2.sokkerpro.com/livescores';
  console.log('Testing connection to:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
        'Referer': 'https://sokkerpro.com/',
        'Origin': 'https://sokkerpro.com'
      }
    });

    console.log('Status:', response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Error Body:', text);
    } else {
      const data = await response.json();
      console.log('Success! Data length:', JSON.stringify(data).length);
    }

  } catch (error) {
    console.error('Fetch failed:', error);
  }
}

testSokkerPro();
