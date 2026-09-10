exports.clampBounds = (bounds, area) => {
 const width=Math.min(bounds.width,area.width),height=Math.min(bounds.height,area.height);
 return {width,height,x:Math.max(area.x,Math.min(bounds.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-height))};
};
