const ctx1 = org_canvas.getContext('2d',{ willReadFrequently: true });
const ctx2 = pre_canvas.getContext('2d');
loading.style.display = 'none';
content.style.display = 'none';
footer.style.display = 'none';
let files = [];
let current_file = 1;
let raw_image;
let pending_render = false;
const API_SER = 'https://script.google.com/macros/s/AKfycbwJHBh0j3FMlvclKdLQIYa1nzFSqsw3ffEBoFtOs3RmuJdu_SVhDaj-QaaLvdhfYqZo/exec';
const API_KEY = localStorage.API_KEY;
let loading_progress;

if (!API_KEY) window.location.href = './api.html';
_loadFont();

function _loadFont(){
    const canvas = document.createElement("canvas");
    //Setting the height and width is not really required
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");

    //If you have more than one custom font, you can just draw all of them here
    for (let i = 1; i <=16; i++){
        ctx.font = "4px cmf"+i;
        ctx.fillText("text", 0, 8);
    }
}

const render_interval = setInterval(()=>{
    if (pending_render) {
        pending_render = false;
        render(files[current_file-1].blocks);
    }
},500)

function getHeight(element)
{
    element.style.visibility = "hidden";
    document.body.appendChild(element);
    var height = element.offsetHeight + 0;
    document.body.removeChild(element);
    element.style.visibility = "visible";
    return height;
}

scroll_prev.addEventListener('click',()=>{
    current_file -= 1;
    current_scroll.innerText = current_file;
    if (current_file <= 1) {
        scroll_prev.disabled = true;
    }
    scroll_next.disabled = false;
    init_file(files[current_file-1].image,files[current_file-1].blocks);
})
scroll_next.addEventListener('click',()=>{
    current_file += 1;
    current_scroll.innerText = current_file;
    if (current_file >= files.length) {
        scroll_next.disabled = true;
    }
    scroll_prev.disabled = false;
    init_file(files[current_file-1].image,files[current_file-1].blocks);
})

download_btn.addEventListener('click',()=>{
    const imageData = pre_canvas.toDataURL('image/jpeg');
    const link = document.createElement('a');
    link.href = imageData;
    link.download = current_file+'.jpg'; // Set your desired filename

    // Simulate a click on the anchor tag to trigger download
    link.click();
});

download_all_btn.addEventListener('click',async ()=>{
    const zip = new JSZip();
    for (const f of files){
        await init_file(f.image,f.blocks);
        const filename = (files.indexOf(f)+1) + '.jpg'
        zip.file(filename,await new Promise((res,rej)=>{pre_canvas.toBlob(res)}));
    }
    const content = await zip.generateAsync({type: "blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'comictrans.zip';
    link.click();
    
});

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hexToRgbArray(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

async function init_file(imageDataUrl,blocks){
    const img = new Image();
    img.src = imageDataUrl;
    await new Promise((resolve) => img.onload = resolve);
    org_canvas.width = img.width;
    org_canvas.height = img.height;
    pre_canvas.width = img.width;
    pre_canvas.height = img.height;
    ctx1.fillRect(0, 0, org_canvas.width, org_canvas.height);
    // console.log(1)
    ctx1.drawImage(img, 0, 0);
    raw_image = img;

    // RENDER TEXTS
    const canvas_scale = window.innerWidth*.3/ org_canvas.width;
    transcript.innerHTML = "";  

    let last_bottom = 0;
    const pixel_data = ctx1.getImageData(0,0, pre_canvas.width, pre_canvas.height);
    for (const [index,block] of blocks.entries()){
        // STORE BACKGROUND COLOR
        const { x, y, width, height } = block.boundingBox;  
        const r = pixel_data.data[(Math.floor(y+height*.9)*pre_canvas.width+Math.floor(x))*4+0];
        const g = pixel_data.data[(Math.floor(y+height*.9)*pre_canvas.width+Math.floor(x))*4+1];
        const b = pixel_data.data[(Math.floor(y+height*.9)*pre_canvas.width+Math.floor(x))*4+2];
        const r2 = pixel_data.data[(Math.floor(y)*pre_canvas.width+Math.floor(x+width*.9))*4+0];
        const g2 = pixel_data.data[(Math.floor(y)*pre_canvas.width+Math.floor(x+width*.9))*4+1];
        const b2 = pixel_data.data[(Math.floor(y)*pre_canvas.width+Math.floor(x+width*.9))*4+2];
        block.background = [
            rgbToHex(r,g,b),
            rgbToHex(r2,g2,b2)
        ]
        block.font = 'cmf1';
        block.text_color =  ((r+r2)/2+(g+g2)/2+(b+b2/2)<382.5 ) ? "#ffffff" : "#000000";
        block.font_size = 0;
        // RENDER BOUNDING BOX ON CANVAS
        ctx1.fillStyle = "transparent";
        ctx1.strokeStyle = "yellow";
        ctx1.lineWidth = 5;
        ctx1.strokeRect(x, y, width, height);

        // RENDER TRANSCRIPT
        const newDiv = document.createElement("div");
        newDiv.innerHTML = `<span>${block.text}</span><hr>`
        newDiv.classList.add("script");

        // INPUTS
        let newLabel = document.createElement('label');
        newLabel.innerText = 'Màu chữ: ';
        newLabel.for = "text-color";
        newDiv.appendChild(newLabel);
        const newInput1 = document.createElement("input");
        newInput1.type = "color";
        newInput1.name = "text-color";
        newInput1.idx = index;
        newInput1.value = block.text_color;
        newInput1.addEventListener('change',()=>{
            blocks[newInput1.idx].text_color = newInput1.value;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput1);

        newLabel = document.createTextNode('\u00A0\u00A0');
        newDiv.appendChild(newLabel);
        newLabel = document.createElement('label');
        newLabel.innerText = 'Màu nền: ';
        newLabel.for = "bg-color-1 bg-color-2";
        newDiv.appendChild(newLabel);
        const newInput2 = document.createElement("input");
        newInput2.type = "color";
        newInput2.name = "bg-color-1";
        newInput2.idx = index;
        newInput2.value = block.background[0];
        newInput2.addEventListener('change',()=>{
            blocks[newInput2.idx].background[0] = newInput2.value;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput2);

        newLabel = document.createTextNode('\u00A0');
        newDiv.appendChild(newLabel);
        const newInput3 = document.createElement("input");
        newInput3.type = "color";
        newInput3.name = "bg-color-2";
        newInput3.idx = index;
        newInput3.value = block.background[1];
        newInput3.addEventListener('change',()=>{
            blocks[newInput3.idx].background[1] = newInput3.value;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput3);

        newLabel = document.createElement('br');
        newDiv.appendChild(newLabel);
        newLabel = document.createElement('label');
        newLabel.innerText = 'Phông chữ: ';
        newLabel.for = "font";
        newDiv.appendChild(newLabel);
        const newInput4 = document.createElement("select");
        newInput4.id = "font";
        newInput4.name = "font";
        newInput4.idx = index;
        newInput4.innerHTML = `
            <option value="Arial">Arial</option>
            <option value="cmf2">Avegaeance iCiel</option>
            <option value="cmf3">BlahBlahUC iCiel</option>
            <option value="cmf4">Blambot Classic iCiel</option>
            <option value="cmf5">CollectEmAll iCiel</option>
            <option value="cmf6">Frank Bellamy iCiel</option>
            <option value="cmf7">Hand Of Sean Pro iCiel</option>
            <option value="cmf8">Heroid iCiel</option>
            <option value="cmf9">HometownHero iCiel</option>
            <option value="cmf10">Hundred Watt iCiel</option>
            <option value="cmf11">OutOfLine iCiel</option>
            <option value="cmf12">PiekosPro iCiel</option>
            <option value="cmf1" selected>ReadyforAnything TB</option>
            <option value="cmf13">SkippySharp iCiel</option>
            <option value="'Times New Roman'">Times New Roman</option>
            <option value="cmf14">WebLettererP iCiel</option>
            <option value="cmf15">Zoinks iCiel</option>
            <option value="cmf16">SpaghettiWesternSans iCiel</option>
        `;
        newInput4.addEventListener('change',()=>{
            blocks[newInput4.idx].font = newInput4.value;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput4);

        newLabel = document.createElement('br');
        newDiv.appendChild(newLabel);
        newLabel = document.createElement('label');
        newLabel.innerText = 'Cỡ chữ: ';
        newLabel.for = "enlarge shrink reset";
        newDiv.appendChild(newLabel);
        const newInput5 = document.createElement("input");
        newInput5.type = "button";
        newInput5.name = "enlarge";
        newInput5.idx = index;
        newInput5.value = "+";
        newInput5.style.width = '25px';
        newInput5.addEventListener('click',()=>{
            blocks[newInput6.idx].font_size += 5;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput5);

        newLabel = document.createTextNode('\u00A0');
        newDiv.appendChild(newLabel);
        const newInput6 = document.createElement("input");
        newInput6.type = "button";
        newInput6.name = "shrink";
        newInput6.idx = index;
        newInput6.value = "-";
        newInput6.style.width = '25px';
        newInput6.addEventListener('click',()=>{
            blocks[newInput6.idx].font_size -= 5;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput6);
        newLabel = document.createTextNode('\u00A0\u00A0');
        newDiv.appendChild(newLabel);
        const newInput7 = document.createElement("input");
        newInput7.type = "button";
        newInput7.name = "reset";
        newInput7.idx = index;
        newInput7.value = "reset";
        newInput7.addEventListener('click',()=>{
            blocks[newInput7.idx].font_size = 0;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        });
        newDiv.appendChild(newInput7);

        newLabel = document.createElement('hr');
        newDiv.appendChild(newLabel);



        const newTextarea = document.createElement("textarea");
        newTextarea.value = block.translation;
        newTextarea.idx = index;
        newTextarea.addEventListener('keyup',()=>{
            blocks[newTextarea.idx].translation = newTextarea.value;
            pending_render = true;
            files[current_file-1].blocks = blocks;
        })

        newDiv.appendChild(newTextarea);

        let displayY = Math.floor(canvas_scale * y );
        if (displayY < last_bottom) displayY += last_bottom - displayY;
        newDiv.style.top = `${displayY}px`;

        last_bottom = displayY + getHeight(newDiv) + 20;


        transcript.appendChild(newDiv);
    }
    //await translate(blocks);
    render(blocks);
}

raw_file.addEventListener("change", async (e)=>{
    const images =[...e.target.files].sort((a,b) => (a.name > b.name) ? -1 : ((b.name > a.name) ? 1 : 0));
    //console.log(images)

    // console.log(e.target.files)
    images.reverse();
    const file = images[0];
    if (!file) return;
    raw_file.disabled  = true;
    content.style.display = 'none';
    footer.style.display = 'none';
    loading.style.display = 'block';
    loading.innerText = 'ĐANG TẢI...';
    let loading_percent = 0;
    clearInterval(loading_progress);
    loading_progress = setInterval(()=>{
        loading.innerText = 'ĐANG TẢI... ('+Math.floor(loading_percent)+'%)';
        loading_percent += (95 - loading_percent)*(Math.random()*.3+.1);
    },1000)

    // INIT
    const imageDataUrl = await readFileAsDataURL(file);
    let blocks = await i2t(imageDataUrl.replace(/^data:image\/(png|jpeg|webp);base64,/, ""));
    if (blocks == -1) {
        loading.style.display = 'none';
        clearInterval(loading_progress);
        raw_file.disabled  = false;
        raw_file.value='';
        return;
    }
    blocks = await translate(blocks);
    if (blocks == -1) {
        loading.style.display = 'none';
        clearInterval(loading_progress);
        raw_file.disabled  = false;
        raw_file.value='';
        return;
    }
    await init_file(imageDataUrl,blocks);
    
    // loading.style.display = 'none';
    clearInterval(loading_progress);
    content.style.display = 'flex';
    //await translate(blocks);
    // render();
    raw_file.disabled  = false;

    files = [];
    current_file = 1;
    scroll_next.disabled = true;
    scroll_prev.disabled = true;
    current_scroll.innerText = current_file;
    files.push({
        image: imageDataUrl,
        blocks:  blocks
    })
    loading.innerText = 'Tải lên hoàn tất: 1/'+images.length+' mục'
    for (let i = 1; i < images.length; i++){
        files.push({
            image: await readFileAsDataURL(images[i]),
            blocks:  await translate(await i2t((await readFileAsDataURL(images[i])).replace(/^data:image\/(png|jpeg|webp);base64,/, "")))
        })
        if (i == current_file) {
            scroll_next.disabled = false;
        }
        loading.innerText = 'Tải lên hoàn tất: '+(i+1)+'/'+images.length+' mục'
    }
    footer.style.display = 'block';
    loading.style.display = 'none';
});

async function readFileAsDataURL(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

async function i2t(img){
    const url = API_SER + '?action=i2t&key='+API_KEY;
    for (let t = 0; t < 10; t ++){
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort(),15000);
        try {
            const res = await fetch(url,{
                signal: controller.signal,
                redirect: "follow",
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                },
                body: JSON.stringify({
                    params: img
                })
            });
            const data = await res.json();
            if (data.error == "Invalid API key") {
                alert('API key đã hết hạn!');
                window.location.href = './api.html';
            }
            console.log(data);
            return data.sort((a,b) => a.boundingBox.y - b.boundingBox.y);
        } catch (error) {
            console.log('Connection timed out');
        } finally {
            clearTimeout(timeout);
        }
    }
    return null;
}

async function translate(blocks){
    const url = API_SER + '?action=translate&key='+API_KEY;
    for (let t = 0; t < 10; t ++){
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort(),20000);
        try {
            const res = await fetch(url,{
                redirect: "follow",
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                    },
                body: JSON.stringify({
                    params: JSON.stringify(blocks)
                })
            });
            const data = await res.json();
            if (data.error == "Invalid API key") {
                alert('API key đã hết hạn!');
                window.location.href = './api.html';
            }
            // console.log(data);
            return data;
        } catch (error) {
            console.log('Connection timed out');
        } finally {
            clearTimeout(timeout);
        }
    }
    return null;
    // const res = await fetch(url,{
    //     redirect: "follow",
    //     method: "POST",
    //     headers: {
    //         "Content-Type": "text/plain;charset=utf-8",
    //       },
    //     body: JSON.stringify({
    //         params: JSON.stringify(blocks)
    //     })
    // });
    // const data = await res.json();
    // if (data.error == "Invalid API key") {
    //     alert('API key đã hết hạn!');
    //     window.location.href = './api.html';
    // }
    // // console.log(data);
    // return data;
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const lines = [];
    let currentLine = "";
    let currentX = x;
    
    const parts = text.split("\n");
    for (const p of parts) {
        const words = p.split(' ');
        for (let i = 0; i < words.length; i++) {
            const char = words[i]  + " ";
            const charWidth = context.measureText(currentLine + char).width;
            
            if (charWidth > maxWidth) {
                lines.push({ text: currentLine, x: currentX, y });
                currentLine = char;
                currentX = x;
                y += lineHeight;
            } else {
                currentLine += char;
            }
        }
        lines.push({ text: currentLine, x: currentX, y });
        currentLine = "";
        currentX = x;
        y += lineHeight;
    }
    
    
    if (currentLine) {
      lines.push({ text: currentLine, x: currentX, y });
    }
    
    return lines;
  }

function render(blocks,option={force_uppercase: false,fill_text: true}){
    ctx2.drawImage(raw_image,0,0);

    for (const block of blocks){
        if (block.translation == '') continue;
        let { x, y, width, height } = block.boundingBox; 

        const min_dimension = 10;
        if (height + block.font_size *2 < min_dimension) {
            block.font_size = (min_dimension - height)/2;
        }
        if (width + block.font_size *2 < min_dimension) {
            block.font_size = (min_dimension - width)/2;
        }
        x -= block.font_size;
        y -= block.font_size;
        width += block.font_size * 2;
        height += block.font_size * 2;


        // Fill background    
        for (const c of block.covers){
            const grad = ctx2.createLinearGradient(c.x ,c.y + c.height*.9 ,c.x + c.width*.9,c.y);
            grad.addColorStop(0, block.background[0]);
            grad.addColorStop(1, block.background[1]);
            ctx2.fillStyle = grad;
            ctx2.fillRect(c.x,c.y,c.width,c.height);
        }
        
    
        // Print text
        if (!option.fill_text) continue;
        const text = (option.force_uppercase) ? block.translation.toUpperCase() : block.translation;
        let font_size;// = 160;
        let texts = [];
        let line_spacing = font_size+ 5;

        let max_font = 1000;
        let min_font = 0;
        do {
            font_size = Math.floor((min_font+max_font)/2);

            line_spacing = font_size+ 5
            ctx2.font = font_size+"px "+block.font;
            texts = wrapText(ctx2,text,x,y,width,line_spacing);
            if(texts.at(-1).y + line_spacing > y + height){
                max_font = font_size -1;
            } else if (texts.at(-1).y + line_spacing < y + height) {
                min_font = font_size +1;
            } else {
                break;
            }
        } while (min_font <= max_font || (texts.at(-1).y + line_spacing > y + height));

    
        ctx2.textAlign = "center";
        ctx2.textBaseline = 'top'
        ctx2.fillStyle = block.text_color.toUpperCase();
        for (const text of texts){
          ctx2.fillText(text.text,text.x+width/2,text.y);
        }
    
      }
}