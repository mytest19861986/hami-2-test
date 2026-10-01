import http from 'node:http';
const port = Number(process.env.PORT || 4000);
const server = http.createServer((req,res)=>{
  res.setHeader('content-type','application/json; charset=utf-8');
  if (req.url === '/api/v1/health') { res.end(JSON.stringify({status:'ok'})); return; }
  res.statusCode=404; res.end(JSON.stringify({status:'not_found'}));
});
server.listen(port,'0.0.0.0',()=>console.log(`api listening on ${port}`));
