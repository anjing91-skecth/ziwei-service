package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Lofanmi/chinese-calendar-golang/calendar"
)

type baziRequest struct {
	BirthDate string `json:"birthDate"`
	BirthTime string `json:"birthTime"`
}

type baziResponse struct {
	Success bool        `json:"success"`
	Error   string      `json:"error,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

func parseDateTime(dateStr, timeStr string) (time.Time, error) {
	if timeStr == "" {
		timeStr = "12:00"
	}
	if len(strings.Split(timeStr, ":")) == 2 {
		timeStr += ":00"
	}
	layout := "2006-01-02 15:04:05"
	return time.ParseInLocation(layout, dateStr+" "+timeStr, time.Local)
}

func handleBazi(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var req baziRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, baziResponse{
			Success: false,
			Error:   "invalid JSON body: " + err.Error(),
		})
		return
	}

	t, err := parseDateTime(req.BirthDate, req.BirthTime)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, baziResponse{
			Success: false,
			Error:   "invalid date/time format",
		})
		return
	}

	year, month, day := t.Date()
	hour := t.Hour()
	minute := t.Minute()
	second := t.Second()

	c := calendar.BySolar(
		int64(year),
		int64(month),
		int64(day),
		int64(hour),
		int64(minute),
		int64(second),
	)
	bytes, err := c.ToJSON()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, baziResponse{
			Success: false,
			Error:   "failed to generate calendar json: " + err.Error(),
		})
		return
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(bytes, &raw); err != nil {
		writeJSON(w, http.StatusInternalServerError, baziResponse{
			Success: false,
			Error:   "failed to parse calendar json: " + err.Error(),
		})
		return
	}

	ganzhi, _ := raw["ganzhi"].(map[string]interface{})
	lunar, _ := raw["lunar"].(map[string]interface{})
	solar, _ := raw["solar"].(map[string]interface{})

	respData := map[string]interface{}{
		"pillars": map[string]interface{}{
			"year":  splitGanzhiString(ganzhi, "year"),
			"month": splitGanzhiString(ganzhi, "month"),
			"day":   splitGanzhiString(ganzhi, "day"),
			"hour":  splitGanzhiString(ganzhi, "hour"),
		},
		"ganzhi_raw": ganzhi,
		"lunar":      lunar,
		"solar":      solar,
	}

	writeJSON(w, http.StatusOK, baziResponse{
		Success: true,
		Data:    respData,
	})
}

func splitGanzhiString(g map[string]interface{}, key string) map[string]string {
	val, _ := g[key].(string)
	if len([]rune(val)) != 2 {
		return map[string]string{
			"gan": val,
			"zhi": "",
		}
	}
	runes := []rune(val)
	return map[string]string{
		"gan": string(runes[0]),
		"zhi": string(runes[1]),
	}
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func main() {
	// Force PRC timezone for calendar calculations
	_ = os.Setenv("TZ", "PRC")
	if loc, err := time.LoadLocation("PRC"); err == nil {
		time.Local = loc
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	if _, err := strconv.Atoi(port); err != nil {
		port = "8081"
	}

	http.HandleFunc("/bazi", handleBazi)

	log.Printf("BaZi Go service running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
