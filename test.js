const fs = require('fs');

const arrays = [];
const traverse = (obj, visited = new Set()) => {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(obj)) {
        if (obj.length > 0) arrays.push(obj);
        for (const item of obj) traverse(item, visited);
    } else {
        for (const key of Object.keys(obj)) traverse(obj[key], visited);
    }
};

const x = { cards: [ { title: '热搜', card_group: [ { desc: 'A' } ] } ] };
traverse(x);
console.log(arrays.map(a => a.length));
