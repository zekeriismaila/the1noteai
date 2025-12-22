import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ArrowLeftRight, Delete } from "lucide-react";
import * as math from "mathjs";

export default function ToolsPanel() {
  return (
    <div>
      <h3 className="font-semibold mb-4">Tools</h3>
      
      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">
            <Calculator className="w-4 h-4 mr-1" />
            Calculator
          </TabsTrigger>
          <TabsTrigger value="converter">
            <ArrowLeftRight className="w-4 h-4 mr-1" />
            Converter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="mt-4">
          <ScientificCalculator />
        </TabsContent>

        <TabsContent value="converter" className="mt-4">
          <UnitConverter />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScientificCalculator() {
  const [display, setDisplay] = useState("0");
  const [memory, setMemory] = useState<string>("");
  const [isResult, setIsResult] = useState(false);

  const handleNumber = (num: string) => {
    if (isResult) {
      setDisplay(num);
      setIsResult(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const handleOperator = (op: string) => {
    setIsResult(false);
    setDisplay(display + op);
  };

  const handleFunction = (fn: string) => {
    setIsResult(false);
    switch (fn) {
      case "sin":
      case "cos":
      case "tan":
      case "log":
      case "ln":
      case "sqrt":
        setDisplay(display === "0" ? `${fn}(` : display + `${fn}(`);
        break;
      case "pi":
        setDisplay(display === "0" ? "pi" : display + "pi");
        break;
      case "e":
        setDisplay(display === "0" ? "e" : display + "e");
        break;
      case "^":
        setDisplay(display + "^");
        break;
      case "(":
      case ")":
        setDisplay(display === "0" ? fn : display + fn);
        break;
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setIsResult(false);
  };

  const handleBackspace = () => {
    if (display.length === 1 || isResult) {
      setDisplay("0");
      setIsResult(false);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleEquals = () => {
    try {
      // Replace common functions for mathjs
      let expr = display
        .replace(/ln\(/g, "log(")
        .replace(/log\(/g, "log10(");
      
      const result = math.evaluate(expr);
      const formattedResult = typeof result === "number" 
        ? Number(result.toPrecision(10)).toString()
        : result.toString();
      
      setDisplay(formattedResult);
      setIsResult(true);
    } catch (error) {
      setDisplay("Error");
      setIsResult(true);
    }
  };

  const buttons = [
    ["sin", "cos", "tan", "^"],
    ["log", "ln", "sqrt", "("],
    ["7", "8", "9", ")"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "pi", "+"],
    ["e", "C", "⌫", "="],
  ];

  const getButtonClass = (btn: string) => {
    if (["="].includes(btn)) return "calc-button calc-button-operator col-span-1";
    if (["+", "-", "*", "/", "^"].includes(btn)) return "calc-button calc-button-operator";
    if (["sin", "cos", "tan", "log", "ln", "sqrt", "(", ")", "pi", "e"].includes(btn)) {
      return "calc-button calc-button-function";
    }
    if (["C", "⌫"].includes(btn)) return "calc-button calc-button-function";
    return "calc-button calc-button-number";
  };

  const handleButtonClick = (btn: string) => {
    if (btn === "C") handleClear();
    else if (btn === "⌫") handleBackspace();
    else if (btn === "=") handleEquals();
    else if (["+", "-", "*", "/"].includes(btn)) handleOperator(btn);
    else if (["sin", "cos", "tan", "log", "ln", "sqrt", "^", "(", ")", "pi", "e"].includes(btn)) {
      handleFunction(btn);
    }
    else handleNumber(btn);
  };

  return (
    <div className="space-y-3">
      <div className="calc-display overflow-x-auto">
        {display}
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {buttons.flat().map((btn, i) => (
          <Button
            key={i}
            variant="ghost"
            className={getButtonClass(btn)}
            onClick={() => handleButtonClick(btn)}
          >
            {btn}
          </Button>
        ))}
      </div>
    </div>
  );
}

function UnitConverter() {
  const [value, setValue] = useState("");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("cm");
  const [category, setCategory] = useState("length");

  const categories = {
    length: {
      units: ["m", "cm", "mm", "km", "in", "ft", "yd", "mi"],
      conversions: {
        m: 1, cm: 0.01, mm: 0.001, km: 1000,
        in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344
      }
    },
    mass: {
      units: ["kg", "g", "mg", "lb", "oz"],
      conversions: {
        kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495
      }
    },
    temperature: {
      units: ["C", "F", "K"],
      conversions: {} // Special handling needed
    },
    angle: {
      units: ["rad", "deg", "grad"],
      conversions: {
        rad: 1, deg: Math.PI / 180, grad: Math.PI / 200
      }
    }
  };

  const convertTemperature = (val: number, from: string, to: string): number => {
    // Convert to Celsius first
    let celsius = val;
    if (from === "F") celsius = (val - 32) * 5/9;
    else if (from === "K") celsius = val - 273.15;

    // Convert from Celsius to target
    if (to === "C") return celsius;
    if (to === "F") return celsius * 9/5 + 32;
    if (to === "K") return celsius + 273.15;
    return celsius;
  };

  const convert = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "";

    if (category === "temperature") {
      return convertTemperature(numValue, fromUnit, toUnit).toFixed(4);
    }

    const cat = categories[category as keyof typeof categories];
    const conversions = cat.conversions as Record<string, number>;
    const baseValue = numValue * conversions[fromUnit];
    const result = baseValue / conversions[toUnit];
    return result.toFixed(6).replace(/\.?0+$/, "");
  };

  const currentUnits = categories[category as keyof typeof categories].units;

  return (
    <div className="space-y-4">
      <Select value={category} onValueChange={(val) => {
        setCategory(val);
        const units = categories[val as keyof typeof categories].units;
        setFromUnit(units[0]);
        setToUnit(units[1]);
      }}>
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="length">Length</SelectItem>
          <SelectItem value="mass">Mass</SelectItem>
          <SelectItem value="temperature">Temperature</SelectItem>
          <SelectItem value="angle">Angle</SelectItem>
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value"
          />
        </div>
        <Select value={fromUnit} onValueChange={setFromUnit}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentUnits.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-center">
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="calc-display text-lg">
          {value ? convert() : "0"}
        </div>
        <Select value={toUnit} onValueChange={setToUnit}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentUnits.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
