require("sucrase/register")
require("./src/server/index.ts")
var express = require("express")

let server = express()
server.use(
  express.static('src/client', {
    setHeaders: function (res, path, stat) {
      res.set('Cross-Origin-Embedder-Policy', 'require-corp')
      res.set('Cross-Origin-Opener-Policy', 'same-origin')
    }
  })
)

server.all('*', function(req, res){
  res.sendfile("src/client/index.html");
});

server.listen(process.env.PORT || 5000)
console.log('serving content on http://localhost:5000')