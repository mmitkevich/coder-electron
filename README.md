This opens your code-server in electron app and supports URL list in ~/.config/coder.yaml to quick connect

# build
```
npm i -g electron electron-build
```

# debug run
```
electron main.js
```

# note

will create ` ~/.config/coder.yaml` with `urls` containing code-server urls 
please do `mkdir -p ~/.config` if that directory not exists

```
urls:
  - https://192.169.250.10:9876
  - https://192.168.249.2:9876
  - http://192.169.250.10:9876
```