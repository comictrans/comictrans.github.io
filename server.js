const API_SER = 'https://script.google.com/macros/s/AKfycbzBLpe66zae97LCo-I_kyhtu-zz3ijc_vebSjbSx5yM6iE8cLIc4WDf449Srd4KIP7q/exec';
const API_SUB_SER = [
    'https://script.google.com/macros/s/AKfycbxs-GJ1v3bI9slfQSNuLgMoJscHfl6VE9hM_EOaFBG6nVgBLCgGaYFw0JU-6cpwkc-meQ/exec'
];
function get_server(){
    const list = [API_SER,...API_SUB_SER];
    return list[Math.floor(Math.random()*list.length)];
}