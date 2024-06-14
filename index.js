let pages = [];
let current_page = 0;
const API_SER = 'https://script.google.com/macros/s/AKfycbz02LImfManoeaEdWunIm6pAb66iO-0m78z-NU24DVOFn6cwjbfuX0AakQ_Wo9gdi_l/exec';
const API_KEY = localStorage.API_KEY;
const SETTING = {...((localStorage.setting) ? JSON.parse(localStorage.setting) : {}),...{
    file_extension: "jpeg",
    font: "cmf1",
    ignore_sfx: true,
    merge_file: true
}};
web_theme.href = './theme_'+(SETTING.theme || 'light')+'.css';
let unsaved = false;

let cancel_upload = false;
let upload_busy = false;

let block_id_counter = 0;

let is_drawing = false; //user input for masking
let pen_mode = 1; // for masking
let pen_size = 10; // for masking
let x,y; // for masking

let last_click_el; 
let clipboard;
let pre_history;
let history = [];
let future = [];

let selected_text; // for translating
function init(){
    // LEAVING WARNING
    window.onbeforeunload = function(){
        if (!unsaved) return undefined;
        return true;
      };

    // LOAD FONT
    function _load_font(){
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
    _load_font();
    // CANVAS SMOOTHING
    canvas1.getContext('2d').imageSmoothingEnabled = false;
    canvas2.getContext('2d').imageSmoothingEnabled = false;
    canvas3.getContext('2d').imageSmoothingEnabled = false;
    canvas4.getContext('2d').imageSmoothingEnabled = false;

    // DOWNLOAD
    download_btn.addEventListener('click',()=>{
        const dataURL = canvas2.toDataURL("image/"+SETTING.file_extension);
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "comictrans"+(current_page+1).toString().padStart(3, '0')+"."+((SETTING.file_extension == "jpeg")? "jpg" : SETTING.file_extension);
        link.click();
    });
    download_all_btn.addEventListener('click',async ()=>{
        const zip = new JSZip();
        for (const page of pages){
            const filename = (pages.indexOf(page)+1).toString().padStart(3, '0') + '.'+((SETTING.file_extension == "jpeg")? "jpg" : SETTING.file_extension);
            zip.file(filename,page.preview);
        }
        const content = await zip.generateAsync({type: "blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'comictrans.zip';
        link.click();
        
    });
      
    // SETUP MID WRAPPER
    window.addEventListener('scroll',()=>{
        document.querySelectorAll('.mid-wrapper').forEach(e=>{
            if (e.sticky){
                if (window.scrollY < e.origin_y){
                    e.style.position = null;
                    e.style.top = null;
                    e.sticky = false;
                }
            } else {
                if (e.getBoundingClientRect().width !== 0 && e.getBoundingClientRect().y <= 0){
                    e.style.position = 'fixed';
                    e.style.top = '10%';
                    e.sticky = true;
                }
            }
        })
    });

    // RERENDER
    window.addEventListener('resize',()=>{
        render_texts(pages[current_page]);
    })

    // BUTTON
    remove_text_button.addEventListener('click',async ()=>{
        const page = pages[current_page];
        const block = page.blocks.find(b=>b.id == selected_text);
        const regen_redraw = block.covers.length>0;
        write_to_history(block,current_page);
        page.blocks.splice(page.blocks.indexOf(block),1); 
        await generate_mask(page,regen_redraw);
        generate_redraw(page,regen_redraw);
        render_texts(page);
        set_text_edit_panel(true);
    });
    add_text_button.addEventListener('click',e=>{
        const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
        const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
        const x = (canvas2.getBoundingClientRect().width*.2) / scaleX;
        const y = (e.clientY - canvas2.getBoundingClientRect().y+ canvas2.getBoundingClientRect().width*.2) / scaleY;
        const font_size = Math.round(canvas2.getBoundingClientRect().width * .04 / scaleX);
        pages[current_page].blocks.push({
            is_user_box: true,
            boundingBox:{
                x: x,
                y: y,
                width: canvas2.getBoundingClientRect().width * .1 / scaleX,
                height: canvas2.getBoundingClientRect().width * .1  / scaleY,
                rotate: 0
            },
            covers:[],
            id: ++block_id_counter,
            translation: "",
            style:{
                border: "#FFFFFF",
                border_width: Math.round(font_size * .25),
                color: "#000000",
                font: SETTING.font,
                font_size: font_size,
                text_align: "center",
                bold: false,
                italic: false,
            }
        });
        write_to_history({id:block_id_counter, boundingBox: null},current_page);
        selected_text = block_id_counter;
        render_texts(pages[current_page]);
        const el = document.querySelector(".text_region.active");
        el.click();
        el.click();
    });
    // SHOTCUT KEYS
    document.addEventListener('click',e=>{
        last_click_el = e.target;
    })
    document.addEventListener("keydown", async (e)=>{
        if (e.key === "Backspace" || e.key === "Delete") {
            const el = document.querySelector(".text_region.active");
            if (last_click_el != el) return;
            const page = pages[current_page];
            const block = page.blocks.find(b=>b.id == selected_text);
            if (!block) return;
            write_to_history(block,current_page);
            const regen_redraw = block.covers.length>0;
            page.blocks.splice(page.blocks.indexOf(block),1); 
            await generate_mask(page,regen_redraw);
            generate_redraw(page,regen_redraw);
            render_texts(page);
            set_text_edit_panel(true);
            return;
        }
        if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
            const page = pages[current_page];
            const block = page.blocks.find(b=>b.id == selected_text);
            clipboard = block;
            return;
        }
        if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
            if (!clipboard) return;
            const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
            const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
            const y = (add_text_button.getBoundingClientRect().y - canvas2.getBoundingClientRect().y+ canvas2.getBoundingClientRect().width*.2) / scaleY;
            pages[current_page].blocks.push({
                is_user_box: true,
                boundingBox:{
                    x: clipboard.boundingBox.width * .6,
                    y: y,
                    width: clipboard.boundingBox.width,
                    height: clipboard.boundingBox.height,
                    rotate: clipboard.boundingBox.rotate
                },
                covers:[],
                id: ++block_id_counter,
                translation: clipboard.translation,
                style: clipboard.style
            });
            write_to_history({id:block_id_counter, boundingBox: null},current_page);
            selected_text = block_id_counter;
            render_texts(pages[current_page]);
            const el = document.querySelector(".text_region.active");
            el.click();
            el.click();
            return;
        }
        if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
            undo();
            return;
        }
        if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
            redo();
            return;
        }

    })

    // ROTATE & CROP HANDLES
    rotate_handle.addEventListener('mousedown',() =>{
        rotate_handle.is_rotating = true;
        rotate_handle.style.fill = "yellow";
        const el = document.querySelector(".text_region.active");
        const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
        write_to_history(block,current_page);
    });
    crop_handle_1.addEventListener('mousedown',() =>{
        crop_handle_1.is_cropping = true;
        const el = document.querySelector(".text_region.active");
        const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
        write_to_history(block,current_page);
        crop_handle_1.org_height = el.height;
        crop_handle_1.style["background-color"] = "yellow";
    });
    crop_handle_2.addEventListener('mousedown',() =>{
        crop_handle_2.is_cropping = true;
        const el = document.querySelector(".text_region.active");
        const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
        write_to_history(block,current_page);
        crop_handle_2.org_height = el.height;
        crop_handle_2.style["background-color"] = "yellow";
    });
    crop_handle_3.addEventListener('mousedown',() =>{
        crop_handle_3.is_cropping = true;
        const el = document.querySelector(".text_region.active");
        const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
        write_to_history(block,current_page);
        crop_handle_3.org_height = el.height;
        crop_handle_3.style["background-color"] = "yellow";
    });
    crop_handle_4.addEventListener('mousedown',() =>{
        crop_handle_4.is_cropping = true;
        const el = document.querySelector(".text_region.active");
        const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
        write_to_history(block,current_page);
        crop_handle_4.org_height = el.height;
        crop_handle_4.style["background-color"] = "yellow";
    });
    document.addEventListener('mouseup', () => {
        if (rotate_handle.is_rotating) {
            rotate_handle.is_rotating = false;
            rotate_handle.style.fill = null;
            render_texts(pages[current_page]);
        }
        if (crop_handle_1.is_cropping){
            crop_handle_1.is_cropping = false;
            crop_handle_1.style["background-color"] = null;
            render_texts(pages[current_page]);
        }
        if (crop_handle_2.is_cropping){
            crop_handle_2.is_cropping = false;
            crop_handle_2.style["background-color"] = null;
            render_texts(pages[current_page]);
        }
        if (crop_handle_3.is_cropping){
            crop_handle_3.is_cropping = false;
            crop_handle_3.style["background-color"] = null;
            render_texts(pages[current_page]);
        }
        if (crop_handle_4.is_cropping){
            crop_handle_4.is_cropping = false;
            crop_handle_4.style["background-color"] = null;
            render_texts(pages[current_page]);
        }
    });
    document.addEventListener('mousemove', e=>{
        const x = e.clientX - canvas2.getBoundingClientRect().x;
        const y = e.clientY - canvas2.getBoundingClientRect().y;
        const el = document.querySelector(".text_region.active");
        if (!el) return;
        const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
        if (rotate_handle.is_rotating) {
            const c_x = rotate_handle.center_x;
            const c_y = rotate_handle.center_y;
            const angle = Math.atan((c_y - y)/(c_x - x)) + Math.PI/2 + ((x < c_x)? + Math.PI : 0);
            
            block.boundingBox.rotate = angle;
            el.style.transform = "translate(-50%,-50%) rotate("+angle+"rad)";
            input7.value = Math.round(block.boundingBox.rotate * 180 / Math.PI * 1000)/1000;
            update_edit_handle(el.x,el.y,el.width,el.height,angle);
        }
        if (crop_handle_1.is_cropping){
            const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
            const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
            // Find coords of point at cursor level
            const _rotate = (block.boundingBox.rotate >= Math.PI*3/2)? block.boundingBox.rotate - Math.PI*2 : (block.boundingBox.rotate > Math.PI/2)? block.boundingBox.rotate - Math.PI : block.boundingBox.rotate;
            const m = (_rotate == Math.PI/2 || _rotate == Math.PI/-2)? NaN : Math.tan(_rotate);
            const _x = (isNaN(m))? x : (m == 0)? el.x : (x * m - y + el.x/m + el.y) / (m + 1/m);
            const _y = (isNaN(m))? el.y : m * (_x - x) + y;
            // highlight_point(_x,_y,0);
            // Find coords of point at bottom
            const a = block.boundingBox.rotate;
            const dx = Math.sin(Math.abs(_rotate)) * el.height/2;
            const dy = Math.cos(Math.abs(_rotate)) * el.height/2;
            const __x = el.x + ((a > Math.PI)? dx : - dx );
            const __y = el.y + ((a > Math.PI/2 && a < Math.PI*3/2) ? - dy : dy);
            // highlight_point(__x,__y,1);
            // Calculate distant to bottom
            const dis = Math.sqrt( (_x - __x)**2 + (_y - __y)**2);
            // Update
            const c_x = (_x+__x)/2;
            const c_y = (_y+__y)/2;
            // highlight_point(c_x,c_y,2);
            rotate_handle.center_x = c_x;
            rotate_handle.center_y = c_y;
            el.style.height = dis + "px";
            el.style.left = c_x + "px";
            el.style.top =c_y+ "px";

            block.boundingBox.height = dis / scaleY;
            block.boundingBox.x = c_x / scaleX;
            block.boundingBox.y = c_y / scaleY;
            input9.value = Math.round(block.boundingBox.height*1000)/1000;
            input10.value = Math.round(block.boundingBox.x*1000)/1000;
            input11.value = Math.round(block.boundingBox.y*1000)/1000;
            update_edit_handle(c_x,c_y,el.width,dis,el.rotate);
        }
        if (crop_handle_2.is_cropping){
            const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
            const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
            // Find coords of point at cursor level
            const _rotate = (block.boundingBox.rotate >= Math.PI*3/2)? block.boundingBox.rotate - Math.PI*2 : (block.boundingBox.rotate > Math.PI/2)? block.boundingBox.rotate - Math.PI : block.boundingBox.rotate;
            const m = (_rotate == Math.PI/2 || _rotate == Math.PI/-2)? NaN : Math.tan(_rotate);
            const _x = (isNaN(m))? x : (m == 0)? el.x : (x * m - y + el.x/m + el.y) / (m + 1/m);
            const _y = (isNaN(m))? el.y : m * (_x - x) + y;
            // Find coords of point at bottom
            const a = block.boundingBox.rotate;
            const dx = Math.sin(Math.abs(_rotate)) * el.height/2;
            const dy = Math.cos(Math.abs(_rotate)) * el.height/2;
            const __x = el.x + ((a > Math.PI)? - dx : dx );
            const __y = el.y + ((a > Math.PI/2 && a < Math.PI*3/2) ? dy : - dy);
            // Calculate distant to bottom
            const dis = Math.sqrt( (_x - __x)**2 + (_y - __y)**2);
            // Update
            const c_x = (_x+__x)/2;
            const c_y = (_y+__y)/2;
            rotate_handle.center_x = c_x;
            rotate_handle.center_y = c_y;
            el.style.height = dis + "px";
            el.style.left = c_x + "px";
            el.style.top =c_y+ "px";

            block.boundingBox.height = dis / scaleY;
            block.boundingBox.x = c_x / scaleX;
            block.boundingBox.y = c_y / scaleY;
            input9.value = Math.round(block.boundingBox.height*1000)/1000;
            input10.value = Math.round(block.boundingBox.x*1000)/1000;
            input11.value = Math.round(block.boundingBox.y*1000)/1000;
            update_edit_handle(c_x,c_y,el.width,dis,el.rotate);
        }
        if (crop_handle_3.is_cropping){
            const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
            const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
            // Find coords of point at cursor level
            const _rotate = (block.boundingBox.rotate >= Math.PI*3/2)? block.boundingBox.rotate - Math.PI*2 : (block.boundingBox.rotate > Math.PI/2)? block.boundingBox.rotate - Math.PI : block.boundingBox.rotate;
            const m = (_rotate == Math.PI/2 || _rotate == Math.PI/-2)? NaN : Math.tan(_rotate);
            const _x = (isNaN(m))? el.x : (m == 0)? x : (el.x * m - el.y + x/m + y) / (m + 1/m);
            const _y = (isNaN(m))? y : m * (_x - el.x) + el.y;
            // Find coords of point at bottom
            const a = block.boundingBox.rotate;
            const dx = Math.cos(Math.abs(_rotate)) * el.width/2;
            const dy = Math.sin(Math.abs(_rotate)) * el.width/2;
            const __x = el.x + ((a > Math.PI/2 && a < Math.PI*3/2)? - dx : dx );
            const __y = el.y + ((a > Math.PI) ? - dy : dy);
            // Calculate distant to bottom
            const dis = Math.sqrt( (_x - __x)**2 + (_y - __y)**2);
            // Update
            const c_x = (_x+__x)/2;
            const c_y = (_y+__y)/2;
            rotate_handle.center_x = c_x;
            rotate_handle.center_y = c_y;
            el.style.width = dis + "px";
            el.style.left = c_x + "px";
            el.style.top =c_y+ "px";

            block.boundingBox.width = dis / scaleX;
            block.boundingBox.x = c_x / scaleX;
            block.boundingBox.y = c_y / scaleY;
            input8.value = Math.round(block.boundingBox.width*1000)/1000;
            input10.value = Math.round(block.boundingBox.x*1000)/1000;
            input11.value = Math.round(block.boundingBox.y*1000)/1000;
            update_edit_handle(c_x,c_y,dis,e.height,el.rotate);
        }
        if (crop_handle_4.is_cropping){
            const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
            const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
            // Find coords of point at cursor level
            const _rotate = (block.boundingBox.rotate >= Math.PI*3/2)? block.boundingBox.rotate - Math.PI*2 : (block.boundingBox.rotate > Math.PI/2)? block.boundingBox.rotate - Math.PI : block.boundingBox.rotate;
            const m = (_rotate == Math.PI/2 || _rotate == Math.PI/-2)? NaN : Math.tan(_rotate);
            const _x = (isNaN(m))? el.x : (m == 0)? x : (el.x * m - el.y + x/m + y) / (m + 1/m);
            const _y = (isNaN(m))? y : m * (_x - el.x) + el.y;
            // Find coords of point at bottom
            const a = block.boundingBox.rotate;
            const dx = Math.cos(Math.abs(_rotate)) * el.width/2;
            const dy = Math.sin(Math.abs(_rotate)) * el.width/2;
            const __x = el.x + ((a > Math.PI/2 && a < Math.PI*3/2)? dx : - dx );
            const __y = el.y + ((a > Math.PI) ? dy : - dy);
            // Calculate distant to bottom
            const dis = Math.sqrt( (_x - __x)**2 + (_y - __y)**2);
            // Update
            const c_x = (_x+__x)/2;
            const c_y = (_y+__y)/2;
            rotate_handle.center_x = c_x;
            rotate_handle.center_y = c_y;
            el.style.width = dis + "px";
            el.style.left = c_x + "px";
            el.style.top =c_y+ "px";

            block.boundingBox.width = dis / scaleX;
            block.boundingBox.x = c_x / scaleX;
            block.boundingBox.y = c_y / scaleY;
            input8.value = Math.round(block.boundingBox.width*1000)/1000;
            input10.value = Math.round(block.boundingBox.x*1000)/1000;
            input11.value = Math.round(block.boundingBox.y*1000)/1000;
            update_edit_handle(c_x,c_y,dis,e.height,el.rotate);
        }
    });


    // SETUP MASKING
    canvas3.addEventListener('mousedown',e=>{
        is_drawing = true;
        const scaleX = canvas3.width / canvas3.offsetWidth;
        const scaleY = canvas3.height / canvas3.offsetHeight;
        x = e.offsetX *scaleX;
        y = e.offsetY *scaleY;

        const ctx = canvas3.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(e.offsetX*scaleX, e.offsetY*scaleY);
        ctx.lineWidth = pen_size*scaleX; 
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FA0000';  // Change this for different colors
        ctx.globalCompositeOperation = (pen_mode === 0)? 'destination-out' : 'source-over';
        ctx.stroke();
        if (pen_mode === 0){
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(e.offsetX*scaleX, e.offsetY*scaleY);
            ctx.lineWidth = pen_size*scaleX; 
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#00000001';  // Change this for different colors
            ctx.globalCompositeOperation = 'source-over';
            ctx.stroke();
        }
    });
    document.addEventListener('mouseup', () => {
        if (!is_drawing) return;
        is_drawing = false;
        pages[current_page].mask = canvas3.getContext('2d').getImageData(0,0,canvas3.width,canvas3.height);
        generate_redraw(pages[current_page],true);
        render_texts(pages[current_page]);
        store_user_mask(pages[current_page]);
      });

    canvas3.addEventListener('mousemove', e=>{
        if (!is_drawing) return;
        const scaleX = canvas3.width / canvas3.offsetWidth;
        const scaleY = canvas3.height / canvas3.offsetHeight;
        const ctx = canvas3.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(e.offsetX*scaleX, e.offsetY*scaleY);
        ctx.lineWidth = pen_size*scaleX; 
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FA0000';  // Change this for different colors
        ctx.globalCompositeOperation = (pen_mode === 0)? 'destination-out' : 'source-over';
        ctx.stroke();
        if (pen_mode === 0){
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(e.offsetX*scaleX, e.offsetY*scaleY);
            ctx.lineWidth = pen_size*scaleX; 
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#00000001';  // Change this for different colors
            ctx.globalCompositeOperation = 'source-over';
            ctx.stroke();
        }
        
        x = e.offsetX *scaleX;
        y = e.offsetY *scaleY;
    });


    // SETUP UPLOAD ZONE
    upload_zone.addEventListener('drop',e=>{
        e.preventDefault();
        upload_zone.style["background-color"] = null;
        if (!e.dataTransfer.files) return;
        file_upload.files = e.dataTransfer.files;
        file_upload.dispatchEvent(new Event('change'));

    });
    upload_zone.addEventListener('dragover',e=>{
        e.preventDefault();
        upload_zone.style["background-color"] = '#54504A';
    });
    upload_zone.addEventListener('dragleave',e=>{
        upload_zone.style["background-color"] = null;
    });

    // SETUP UPLOAD
    file_upload.addEventListener('change', async ()=>{
        const files = [...file_upload.files].filter(e=>e.type.split('/')[0] === 'image');
        if (!files[0]) return;
        // console.log(files)
        if (pages.length > 0) {
            const confirmation = confirm('Bạn có chắc muốn thay thế tất cả ảnh hiện tại?');
            if (!confirmation) {
                file_upload.value = null;
                return;
            };
        }
        if (upload_busy) {
            const confirmation = confirm('Bạn có chắc muốn thay thế tải lên hiện tại?');
            if (!confirmation) {
                file_upload.value = null;
                return;
            };
            cancel_upload = true;
            upload_progress.innerText = "Đang hủy tải lên..."
            await new Promise((res,rej)=>{
                const i = setInterval(()=>{
                    if (upload_busy) return;
                    clearInterval(i);
                    res();
                },100);
            })
        }
        download_all_btn.hidden = false;
        download_all_btn.disabled = true;
        document.querySelector('.content').hidden = true;
        unsaved = true;
        cancel_upload = false;
        upload_busy = true;

        // PROCESS IMAGE
        upload_progress.innerText = 'Đang gộp các ảnh...';
        const images = await merge_files(files);
        pages = [];
        let progress = 0;
        upload_progress_bar.max = images.length;
        upload_progress_bar.value = 0;
        upload_progress_bar.hidden = false;
        const fake_progress = setInterval(()=>{
            if (cancel_upload) return;
            progress += (0.5 -  (progress % 0.5)) * (Math.random() * 0.05);
            upload_progress.innerText = `Đang phân tích ảnh, hoàn thành: ${Math.floor(progress)}/${images.length} ảnh (${Math.round(progress/images.length*100)}%)`;
            upload_progress_bar.value = progress;
        },100)
        
        upload_progress.innerText = `Đang phân tích ảnh, hoàn thành: 0/${images.length} ảnh (0%)`;
        for (const image of images){
            if (cancel_upload) break;
            const data = image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
            const page = {
                blocks: await i2t(data),
                image: image
            }
            page.blocks = merge_blocks(page.blocks);

            if (SETTING.ignore_sfx){
                page.blocks = page.blocks.filter(b=>{
                    let score = 0;
                    score += (b.language === undefined)? -4 : 6;
                    score += (Math.abs(b.boundingBox.rotate) > 0.0174533)? -7 : 8;
                    score += (b.text.includes(' '))? 7 : -8;
                    score += (b.text.includes(','))? 1 : 0;
                    score += (b.text.includes('.'))? 1 : 0;
                    score += (b.text.length > 5)? 5 : 0;
                    score += (b.text.length < 3)? -1 : 0;
                    score += (b.text.length == 1 && b.text.toLowerCase() != "i")? -5 : 0;
                    score += (new RegExp(`[^abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?!*:.,()"']`, 'g').test(b.text))? -5 : 3; // CHECK IF CONTAINING ANY NOT ALLOWED CHARACTER
                    score += (new RegExp(/^\d+$/, 'g').test(b.text))? -5 : 0; // CHECK IF ONLY CONTAINING NUMBER

                    return score >= 0;
                });
            }

            progress = Math.floor(progress) + 0.5;
            page.blocks.forEach(block=>block.text = block.text.toLowerCase());
            page.blocks = await translate(page.blocks);
            if (cancel_upload) break;
            await generate_mask(page,undefined,canvas5,img3);
            if (cancel_upload) break;
            generate_redraw(page,undefined,canvas6,img3);
            render_texts(page,false,canvas5);
            pages.push(page);
            progress = Math.floor(progress) + 1;

            if (images.indexOf(image) === 0){
                // DISPLAY IMAGE
                if (document.querySelector('.content').hidden) {
                    document.querySelector('.content').hidden = false;
                    let org_y;
                    document.querySelectorAll('.mid-wrapper').forEach(e=>{
                        if (!org_y) org_y = e.getBoundingClientRect().y;
                        setTimeout(()=>e.origin_y = org_y);
                    });
                }
                set_page(0);
            }
            if (current_page < images.indexOf(image)) {
                page_button2.disabled = false;
            }
            page_display.innerText = `Trang: ${current_page+1}/${pages.length}`;
        }
        upload_progress.innerText = 'Xử lý ảnh hoàn tất!';
        clearInterval(fake_progress);
        upload_progress_bar.hidden = true;

        upload_busy = false;
        download_all_btn.disabled = false;
    })
}
init();

function write_to_history(block,page_num){
    future = [];
    history.push({block: JSON.parse(JSON.stringify(block)), page_num: page_num});
    if (history.length > 16) history.shift();
}

function write_to_future(block_id,page_num,replace){
    const page = pages[page_num];
    const block = page.blocks.find(b=> b.id == block_id) || replace.block;
    future.push({block: JSON.parse(JSON.stringify(block)), page_num: page_num,replace});
}

async function undo(){
    if (!history[history.length-1]) return;
    const {block, page_num} = history[history.length-1];
    const page = pages[page_num];
    write_to_future(block.id,page_num,history.pop());
    const block_to_modify = page.blocks.find(b=> b.id == block.id);
    const regen_redraw = block.covers?.length>0;
    if (block_to_modify) {
        if (block.boundingBox === null) {
            page.blocks.splice(page.blocks.indexOf(block),1); 
            set_text_edit_panel(true);
        } else {
            page.blocks[page.blocks.indexOf(block_to_modify)] = block;
        }
    } else {
        page.blocks.push(block);
    }
    await generate_mask(page,regen_redraw);
    generate_redraw(page,regen_redraw);
    render_texts(page);
    const el = document.querySelector(".text_region.active");
    el.click();
    el.click();
}
async function redo(){
    if (!future[future.length-1]) return;
    const {block, page_num,replace} = future[future.length-1];
    const page = pages[page_num];
    future.pop();
    history.push(replace);
    const block_to_modify = page.blocks.find(b=> b.id == block.id);
    const regen_redraw = block.covers?.length>0;
    if (block_to_modify) {
        if (block.boundingBox === null) {
            page.blocks.splice(page.blocks.indexOf(block),1); 
            set_text_edit_panel(true);
        } else {
            page.blocks[page.blocks.indexOf(block_to_modify)] = block;
        }
    } else {
        page.blocks.push(block);
    }
    await generate_mask(page,regen_redraw);
    generate_redraw(page,regen_redraw);
    render_texts(page);
    const el = document.querySelector(".text_region.active");
    el.click();
    el.click();
}

function highlight_point(x,y,id){
    const highlight = document.querySelectorAll('.highlight')[id]
    highlight.style.left = x + "px";
    highlight.style.top = y+ "px";
}

async function merge_files(files){
    const max_height = 9000;
    const canvas = canvas1;
    const ctx = canvas.getContext('2d');
    let images = [];
    let current_height = 0;
    let current_width = 0;
    let pending = [];
    for (const file of files){
        const img = new Image();
        img.src = await read_file_as_data_url(file);
        await new Promise((resolve) => img.onload = resolve);
        if (current_height + img.naturalHeight <= max_height && img.naturalWidth == current_width && (SETTING.merge_file)){
            current_height += img.naturalHeight;
            pending.push(img);
        } else {
            canvas.width = current_width;
            canvas.height = current_height;
            let y = 0;
            if (pending.length > 0){
                for (const p of pending){
                    ctx.drawImage(p,0,y);
                    y += p.naturalHeight
                }
                images.push(canvas.toDataURL());
            }
            
            pending = [];
            current_height = img.naturalHeight;
            current_width = img.naturalWidth;
            pending.push(img);
        }
    }
    canvas.width = current_width;
    canvas.height = current_height;
    let y = 0;
    for (const p of pending){
        ctx.drawImage(p,0,y);
        y += p.naturalHeight
    }
    images.push(canvas.toDataURL());
    // console.log(images)
    return images;
}

function merge_blocks(blocks){
    let new_blocks = [];
    for (const block of blocks){
        const available_block = new_blocks.find(b=>{
            return (block.language === undefined || b.language === undefined || b.language === block.language || !['en','vi','ko','ja','zh-CN'].includes(b.language) || !['en','vi','ko','ja','zh-CN'].includes(block.language))
            && (b.boundingBox.rotate < 0.0523599 || b.boundingBox.rotate > Math.PI * 2 - 0.0523599)
            && Math.abs(block.boundingBox.x - b.boundingBox.x) < 10
            && (block.boundingBox.y - block.boundingBox.height/2) - (b.boundingBox.y + b.boundingBox.height/2) < 30
        });
        if (available_block){
            available_block.text += " " + block.text;
            available_block.covers = [...available_block.covers,...block.covers];
            available_block.boundingBox.rotate = (available_block.boundingBox.rotate - ((available_block.boundingBox.rotate > Math.PI)? Math.PI*2 : 0) + block.boundingBox.rotate - ((block.boundingBox.rotate > Math.PI)? Math.PI*2 : 0))/2;
            available_block.boundingBox.rotate = (available_block.boundingBox.rotate + Math.PI*2) % (Math.PI*2);
            available_block.boundingBox.x = (available_block.boundingBox.x + block.boundingBox.x)/2;
            available_block.boundingBox.y = ((block.boundingBox.y + block.boundingBox.height/2) + (available_block.boundingBox.y - available_block.boundingBox.height/2))/2;
            available_block.boundingBox.width = Math.max(available_block.boundingBox.width,block.boundingBox.width);
            available_block.boundingBox.height = (block.boundingBox.y + block.boundingBox.height) - (available_block.boundingBox.y - available_block.boundingBox.height/2);

        } else {
            new_blocks.push(block);
        }
    }
    return new_blocks;
}

async function set_page(num){
    current_page = num;
    if (num <= 0) {
        page_button1.disabled = true;
    } else {
        page_button1.disabled = false;
    }
    if (num >= pages.length - 1) {
        page_button2.disabled = true;
    } else {
        page_button2.disabled = false;
    }

    page_display.innerText = `Trang: ${num+1}/${pages.length}`;

    const page = pages[num];
    await generate_mask(page);
    generate_redraw(page);

    await highlight_texts(page);
    render_texts(page);

    set_text_edit_panel(true);
}

function set_active_tab(num){
    nav.querySelectorAll('.tabs-nav-child').forEach((e,i)=>{
        if (i == num) {
            e.classList.add('active');
        } else {
            e.classList.remove('active')
        }
    });
    tabs.querySelectorAll('.tabs-content-child').forEach((e,i)=>{
        if (i == num) {
            e.classList.add('active');
        } else {
            e.classList.remove('active')
        }
    });
    document.querySelectorAll('.mid-wrapper').forEach(e=>{
        if (e.sticky){
            if (window.scrollY < e.origin_y){
                e.style.position = null;
                e.sticky = false;
            }
        } else {
            if (e.getBoundingClientRect().y <= 0){
                e.style.position = 'fixed';
                e.sticky = true;
            }
        }
    });
    if (!mask_tool0.style['border-width']) mask_tool0.style['border-width'] = 10 / 2 * (canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width) + "px";
}

async function read_file_as_data_url(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
}

async function generate_mask(page,forced = false,m_canvas = canvas3,img = img2){
    img.src = page.image;
    await new Promise((resolve) => img.onload = resolve);
    m_canvas.height = img.naturalHeight;
    m_canvas.width = img.naturalWidth;

    const ctx = m_canvas.getContext('2d',{willReadFrequently:true});
    if (page.mask && !forced) {
        ctx.putImageData(page.mask,0,0);
        return;
    };
    ctx.fillStyle = '#FF0000';
    for(const block of page.blocks){
        for(const vertices of block.covers){
            // ctx.beginPath();
            // ctx.moveTo(vertices[0].x, vertices[0].y);
            // for(let i = 1; i < vertices.length; i++){
            //     ctx.lineTo(vertices[i].x, vertices[i].y);
            // }
            // ctx.closePath();
            // ctx.fill();
            // Draw the quadrilateral with smooth corners using bezier curves
            const radius = 10;
            ctx.beginPath();
            ctx.moveTo(vertices[0].x + radius, vertices[0].y);

            for (let i = 1; i <= vertices.length; i++) { // Loop until i === vertices.length
                const prev = vertices[(i - 1 + vertices.length) % vertices.length]; // Correctly wrap around
                const current = vertices[i % vertices.length]; // Correctly wrap around
                const next = vertices[(i + 1) % vertices.length];
            
                const cp1x = current.x + (next.x - current.x) / 3;
                const cp1y = current.y + (next.y - current.y) / 3;
                const cp2x = current.x - (current.x - prev.x) / 3;
                const cp2y = current.y - (current.y - prev.y) / 3;
            
                ctx.lineTo(cp2x, cp2y); 
                ctx.quadraticCurveTo(current.x, current.y, cp1x, cp1y); 
              }

            ctx.closePath();
            // ctx.fillStyle = 'red';
            ctx.fill();
        }
    }
    if (page.user_mask){
        const canvas = document.createElement('canvas');
        canvas.width = m_canvas.width;
        canvas.height = m_canvas.height;

        canvas.getContext('2d').putImageData(page.user_mask,0,0);
        
        const img = new Image();
        img.src = canvas.toDataURL();
        await new Promise((resolve) => img.onload = resolve);
        // console.log(img)
        ctx.drawImage(img,0,0)
        // root.appendChild(img)
    }
    page.mask = ctx.getImageData(0,0,m_canvas.width,m_canvas.height);
}

function store_user_mask(page){
    setTimeout(()=>{
        ctx =  canvas3.getContext('2d',{willReadFrequently: true});
        // console.log(0);
        let log = false;
        page.user_mask =  ctx.getImageData(0,0,canvas3.width,canvas3.height);
        const canvas_width = canvas3.width;
        const data = page.user_mask.data;
        for (let y = 0; y < canvas3.height; y++){
            for (let x = 0; x < canvas3.width; x++){
                const [r,g,b,a] = get_pixel_data(x,y,data,canvas_width);
                if (((r === 0 && g === 0 && b === 0 && a === 1)) && !log){
                        log = true;
                        console.log(a)
                    }
                if ((r < 255 && r > 200 && g === 0 && b === 0) || ((r === 0 && g === 0 && b === 0 && a === 1)) || ((r === 0 && g === 0 && b === 0 && a === 0))) continue;
                data[(Math.floor(y)*canvas_width+Math.floor(x))*4+0] = 0;
                data[(Math.floor(y)*canvas_width+Math.floor(x))*4+1] = 0;
                data[(Math.floor(y)*canvas_width+Math.floor(x))*4+2] = 0;
                data[(Math.floor(y)*canvas_width+Math.floor(x))*4+3] = 0;
                // if (!log){
                //     log = true;
                //     console.log(data[(Math.floor(y)*canvas_width+Math.floor(x))*4+3])
                // }
            }
        }
    })
}

function get_pixel_data(x,y,data,canvas_width){
    if ((Math.floor(y)*canvas_width+Math.floor(x)) > data.length) return [0,0,0,0];
    if (x < 0 || y < 0) return [0,0,0,0];
    return [
        data[(Math.floor(y)*canvas_width+Math.floor(x))*4+0],
        data[(Math.floor(y)*canvas_width+Math.floor(x))*4+1],
        data[(Math.floor(y)*canvas_width+Math.floor(x))*4+2],
        data[(Math.floor(y)*canvas_width+Math.floor(x))*4+3]
    ].map(e=>(e===undefined)?0:e);
        
}

function generate_redraw(page,forced = false,r_canvas = canvas4,img = img2){
    const canvas_width = img.naturalWidth;
    const canvas_height = img.naturalHeight;
    r_canvas.height = canvas_height;
    r_canvas.width = canvas_width;
    const ctx = r_canvas.getContext('2d',{willReadFrequently: true});

    if (page.redraw && !forced) {
        ctx.putImageData(page.redraw,0,0);
        return;
    };

    ctx.drawImage(img,0,0);
    let pixel_data = ctx.getImageData(0,0,canvas_width,canvas_height).data;

    let lines = [];
    let in_line = false;
    for (let x = 0; x < canvas_width; x++){
        for (let y = 0; y < canvas_height; y++){
            const [r,g,b,a] = get_pixel_data(x,y,page.mask.data,canvas_width);
            if (r === 0 && g === 0 && b === 0 && a < 171) {
                if (in_line) {
                    in_line = false;
                    lines[lines.length-1].colors.push(get_pixel_data(x,y,pixel_data,canvas_width));
                }
            } else {
                // console.log(a)
                if (in_line){
                    lines[lines.length-1].height ++;
                } else {
                    in_line = true;
                    lines.push({x:x,y:y,width:1,height:1,colors:[get_pixel_data(x-1,y,pixel_data,canvas_width)]});
                }
            }
        }
    }
    for (const line of lines){
        const gradient = ctx.createLinearGradient(line.x,line.y,line.x+line.width-1,line.y+line.height-1);
        gradient.addColorStop(0,`rgb(${line.colors[0][0]},${line.colors[0][1]},${line.colors[0][2]})`);
        gradient.addColorStop(1,`rgb(${line.colors[1][0]},${line.colors[1][1]},${line.colors[1][2]})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(line.x,line.y,line.width,line.height);
    }
    page.redraw = ctx.getImageData(0,0,r_canvas.width,r_canvas.height);
}

async function highlight_texts(page){
    img1.src = page.image;
    await new Promise((resolve) => img1.onload = resolve);
    canvas1.width = img1.naturalWidth;
    canvas1.height = img1.naturalHeight;
    const ctx = canvas1.getContext('2d');

    for(const block of page.blocks){
        if (block.is_user_box) continue;
        const { x, y, width, height } = block.boundingBox;  
        ctx.fillStyle = "transparent";
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 5;
        ctx.save();
        ctx.translate(x, y);
        // ctx.fillStyle = "red";
        // ctx.fillRect(-10,-10,20,20);
        // ctx.fillStyle = "transparent";
        ctx.rotate(block.boundingBox.rotate );
        ctx.strokeRect(-width/2, -height/2, width, height);
        ctx.restore();
    }
}
function rgb_to_hex(r, g, b) {

    // Check if values are within valid range (0-255)
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        return null; // Return null for invalid input
    }
    if ((r !== 0 && !r) || (g !== 0 && !g) || (b !== 0 && !b)) {
        return null; // Return null for invalid input
    }
    
    // Convert each value to hexadecimal string with padding
    const hexR = r.toString(16).padStart(2, '0');
    const hexG = g.toString(16).padStart(2, '0');
    const hexB = b.toString(16).padStart(2, '0');
    
    // Combine hex strings and add "#" prefix
    return `#${hexR}${hexG}${hexB}`;
    
  }
function render_texts(page,forced = true,t_canvas = canvas2){
    t_canvas.width = page.redraw.width;
    t_canvas.height = page.redraw.height;

    const ctx = t_canvas.getContext('2d');
    ctx.putImageData(page.redraw,0,0);


    const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
    const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;

    if (forced) document.querySelectorAll('.text_region').forEach(e=>e.remove());

    for (const block of page.blocks){
        const { x, y, width, height } = block.boundingBox;  
        // INITIALIZE
        if (block.id === undefined){
            block.id = block_id_counter;
            block_id_counter++;
        }
        if (!block.style){
            let font_size;
            let texts = [];
            const text = block.translation;
            let line_spacing = font_size+ 5;
            const max_height = y + height/1.1+10;

            let max_font = 1000;
            let min_font = 0;
            do {
                font_size = Math.floor((min_font+max_font)/2);

                line_spacing = font_size+ 5
                ctx.font = font_size+"px "+(SETTING.font);
                texts = wrap_text(ctx,text,x,y,width,line_spacing);
                if(texts.at(-1).y + line_spacing > max_height){
                    max_font = font_size -1;
                } else if (texts.at(-1).y + line_spacing < max_height) {
                    min_font = font_size +1;
                } else {
                    break;
                }
            } while (min_font <= max_font || (texts.at(-1).y + line_spacing > max_height));
            // console.log(texts)

            const [r,g,b] = get_pixel_data(x,y+height/2,page.redraw.data,t_canvas.width);
            const color = (r + g + b > 127.5*3) ? "#000000" : "#FFFFFF";
            const border =  rgb_to_hex(r,g,b)//(r + g + b > 127.5*3) ? "#FFFFFF" : "#000000";
            // console.log(r + g + b )
            block.style = {
                font_size: font_size,
                font: SETTING.font,
                text_align: "center",
                color: color,
                border: border,
                border_width: Math.round(font_size * .25),
                bold: false,
                italic: false,
            }
        }

        // RENDER TEXT
        const font_size = block.style.font_size;
        const line_height = font_size + 5;
        ctx.font = `${(block.style.italic)? 'italic' : 'normal'} normal ${(block.style.bold)? 'bold' : 'normal'} ${font_size}px ${block.style.font}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = block.style.color;
        ctx.lineWidth = block.style.border_width;
        ctx.strokeStyle = block.style.border;
        ctx.textAlign = block.style.text_align;
        const align_offset = (block.style.text_align == "center") ? 0 : (block.style.text_align == "right") ? width / 2 : -width / 2;
        const texts = wrap_text(ctx,block.translation,x,y-height/2,width,line_height);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(block.boundingBox.rotate );
        if (block.style.border_width > 0){
            for (const text of texts){
                ctx.strokeText(text.text,align_offset,text.y-y);
            }
        }
        for (const text of texts){
            ctx.fillText(text.text,align_offset,text.y-y);
        }
        ctx.restore();
        
        if (!forced)  continue;
        // RENDER INTERACTION BOX
        const div =  document.createElement('div');
        div.classList.add('text_region');
        div.style.left = x * scaleX +"px";
        div.style.top = y * scaleY +"px";
        div.style.width = width * scaleX +"px";
        div.style.height = height  * scaleY +"px";
        div.style.transform = "translate(-50%,-50%) rotate("+block.boundingBox.rotate+"rad)";
        div.block_id = block.id;
        div.x = x  * scaleX;
        div.y = y * scaleY;
        div.rotate = block.boundingBox.rotate;
        div.height = height  * scaleY;
        div.width = width  * scaleX;
        div.addEventListener('click',e=>{
            // console.log('clicked')
            const el = e.target;
            if (selected_text == el.block_id){
                el.classList.remove('active');
                selected_text = undefined;

                set_text_edit_panel(true);
                return;
            }

            const block = pages[current_page].blocks.find(b=>b.id == el.block_id);

            selected_text = el.block_id;
            el.classList.add('active');
            document.querySelectorAll('.text_region').forEach(e=>{
                if (selected_text != e.block_id) {
                    e.classList.remove('active');
                }
            });

            set_text_edit_panel(false);

            input0.value = block.translation;
            input1.value = block.style.font;
            input2.value = block.style.font_size;
            input3.value = block.style.color;
            input4.value = block.style.text_align;
            input5.value = block.style.border;
            input6.value = block.style.border_width;

            input7.value = Math.round(block.boundingBox.rotate * 180 / Math.PI * 1000)/1000;
            input8.value = Math.round(block.boundingBox.width*1000)/1000;
            input9.value = Math.round(block.boundingBox.height*1000)/1000;
            input10.value = Math.round(block.boundingBox.x*1000)/1000;
            input11.value = Math.round(block.boundingBox.y*1000)/1000;

            input12.value = block.style.bold;
            input13.value = block.style.italic;

            rotate_handle.center_x = el.x;
            rotate_handle.center_y = el.y;
            update_edit_handle(el.x,el.y,el.width,el.height,el.rotate);
        });
        div.addEventListener('mousedown',e=>{
            if (!e.target.classList.contains("active")) return;
            const el = e.target;
            el.moving = true;

            el.move_x = e.clientX;
            el.move_y = e.clientY;

            el.moved = false;

        })
        div.addEventListener('mouseup',e=>{
            const el = e.target;
            el.moving = false;
            // console.log(el.moved)
            if (el.moved) {
                const block = pages[current_page].blocks.find(b=>b.id == el.block_id);
                const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
                const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
                write_to_history(block,current_page);
                block.boundingBox.x = el.x / scaleX;
                block.boundingBox.y = el.y / scaleY;
                render_texts(pages[current_page]);
            }
            
        })
        div.addEventListener('mousemove',e=>{
            const el = e.target;
            if (!el.moving) return;
            const scaleX = canvas2.offsetWidth/ canvas2.width || canvas4.offsetWidth/ canvas4.width;
            const scaleY = canvas2.offsetHeight/ canvas2.height || canvas4.offsetHeight/ canvas4.height;
            el.moved = true;
            const delta_x = e.clientX - el.move_x;
            const delta_y = e.clientY - el.move_y;
            el.move_x = e.clientX;
            el.move_y = e.clientY;
            // console.log(delta_x, delta_y)
            el.x += delta_x;
            el.y += delta_y;
            el.style.left = el.x +"px";
            el.style.top = el.y +"px";
            rotate_handle.center_x = el.x;
            rotate_handle.center_y = el.y;
            input10.value = Math.round(el.x/scaleX*1000)/1000;
            input11.value = Math.round(el.y/scaleY*1000)/1000;
            update_edit_handle(el.x,el.y,el.width,el.height,el.rotate);
        });
        div.addEventListener('mouseleave',e=>{
            const el = e.target;
            if (!el.moving) return;
            el.moved = true;
            const delta_x = e.clientX - el.move_x;
            const delta_y = e.clientY - el.move_y;
            el.move_x = e.clientX;
            el.move_y = e.clientY;
            // console.log(delta_x, delta_y)
            el.x += delta_x;
            el.y += delta_y;
            el.style.left = el.x +"px";
            el.style.top = el.y +"px";
            rotate_handle.center_x = el.x;
            rotate_handle.center_y = el.y;
            update_edit_handle(el.x,el.y,el.width,el.height,el.rotate);
        });
        canvas2.parentElement.prepend(div);        
    }
    if (forced) {
        document.querySelectorAll('.text_region').forEach(el=>{
            if (selected_text == el.block_id) {
                el.classList.add('active');
                update_edit_handle(el.x,el.y,el.width,el.height,el.rotate);
            }
        });
    }
    t_canvas.toBlob(blob=>page.preview = blob,"image/"+SETTING.file_extension);
}

function update_edit_handle(x,y,width,height,rotate){
    rotate_handle.style.top = y +"px";
    rotate_handle.style.left = x +"px";
    rotate_handle.style.transform = "translate(-50%, -50%) rotate("+rotate+"rad) translate(0, "+(-height/2-25)+"px)";

    crop_handle_1.style.top = y +"px";
    crop_handle_1.style.left = x +"px";
    crop_handle_1.style.transform = "translate(-50%, -50%) rotate("+rotate+"rad) translate(0, "+(-height/2-2)+"px)";

    crop_handle_2.style.top = y +"px";
    crop_handle_2.style.left = x +"px";
    crop_handle_2.style.transform = "translate(-50%, -50%) rotate("+rotate+"rad) translate(0, "+(height/2+2)+"px)";

    crop_handle_3.style.top = y +"px";
    crop_handle_3.style.left = x +"px";
    crop_handle_3.style.transform = "translate(-50%, -50%) rotate("+(rotate)+"rad) translate("+(-width/2-2)+"px, 0)";

    crop_handle_4.style.top = y +"px";
    crop_handle_4.style.left = x +"px";
    crop_handle_4.style.transform = "translate(-50%, -50%) rotate("+(rotate)+"rad) translate("+(width/2+2)+"px, 0)";
}

function set_text_edit_panel(hidden){
    input0.parentElement.hidden = hidden;
    input1.parentElement.hidden = hidden;
    input7.parentElement.hidden = hidden;
    remove_text_button.parentElement.hidden = hidden;
    rotate_handle.hidden = hidden;
    rotate_handle.style.visibility = (hidden)? "hidden": "visible";
    document.querySelectorAll('.crop_handle').forEach(e=>e.hidden = hidden);
}

function wrap_text(context, text, x, y, max_width, line_height) {
    let lines = [];
    let current_line = "";
    let sections = text.split('\n');
    for (const section of sections) {
        let words = section.split(" ");
        for (const word of words){
            if (context.measureText(current_line + word).width <= max_width){
                current_line += word + " ";
            } else {
                lines.push({text: (current_line.at(-1) == " ") ? current_line.slice(0,-1) : current_line, x: x, y: y});
                y += line_height;
                
                if (context.measureText(word).width > max_width){
                    current_line = "";
                    for (const char of word) {
                        
                        if (context.measureText(current_line + char).width <= max_width){
                            current_line += char;
                        } else {
                            lines.push({text: current_line, x: x, y: y});
                            y += line_height;
                            current_line = char;
                        }
                        // console.log(current_line)
                    }
                } else {
                    current_line = word + " ";
                }
                
                
            }
    
        }
        if (current_line) lines.push({text: (current_line.at(-1) == " ") ? current_line.slice(0,-1) : current_line, x: x, y: y});
        y += line_height;
        current_line = "";
    }
    // if (aaaa) console.log(lines);
    return lines;
}

async function i2t(img){
    const url = API_SER + '?action=i2t&key='+API_KEY;
    for (let t = 0; t < 10; t ++){
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort("Connection timed out"),60000);
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
                window.location.href = './index.html';
            }
            data.forEach(e=> {e.boundingBox.rotate = (e.boundingBox.rotate +  Math.PI*2 ) % (Math.PI*2);});
            return data.sort((a,b) => a.boundingBox.y - b.boundingBox.y);
        } catch (error) {
            console.log('Error: ',error);
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
        const timeout = setTimeout(()=>controller.abort("Connection timed out"),20000);
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
                window.location.href = './index.html';
            }
            // console.log(data);
            return data.filter(b=>b.text!=b.translation);
        } catch (error) {
            console.log('Connection timed out');
        } finally {
            clearTimeout(timeout);
        }
    }
    return null;
}